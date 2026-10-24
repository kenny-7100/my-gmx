//! Minimal RESP2 cluster fixture for exercising the real RedisStore entry points.

use std::collections::{BTreeMap, HashMap, VecDeque};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::task::{JoinHandle, JoinSet};

use super::{ClusterClient, ConnectionSlot, RedisStore};

#[derive(Clone, Copy)]
pub(crate) enum Failure {
    Error,
    Disconnect,
    #[cfg(feature = "nightly-candles-read-pool")]
    Delay(Duration),
}

#[derive(Default)]
struct Data {
    strings: HashMap<String, String>,
    zsets: HashMap<String, BTreeMap<i64, String>>,
    failures: HashMap<(String, String), VecDeque<Failure>>,
    commands: Vec<Vec<String>>,
    delayed_in_flight: usize,
}

pub(crate) struct RedisFixture {
    port: u16,
    data: Arc<Mutex<Data>>,
    server: JoinHandle<()>,
}

impl RedisFixture {
    pub(crate) async fn start() -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let data = Arc::new(Mutex::new(Data::default()));
        let shared = data.clone();
        let server = tokio::spawn(async move {
            let mut connections = JoinSet::new();
            loop {
                tokio::select! {
                    accepted = listener.accept() => {
                        let (stream, _) = accepted.unwrap();
                        connections.spawn(serve(stream, port, shared.clone()));
                    }
                    _ = connections.join_next(), if !connections.is_empty() => {}
                }
            }
        });
        Self { port, data, server }
    }

    pub(crate) fn store(&self) -> RedisStore {
        // Disable client-internal retries to deterministically exercise the store's
        // own reconnect boundary; command/connection handling is otherwise real.
        let client = Arc::new(
            ClusterClient::builder(vec![format!("redis://127.0.0.1:{}/", self.port)])
                .retries(0)
                .build()
                .unwrap(),
        );
        RedisStore {
            read: Arc::new(ConnectionSlot::new(client.clone())),
            write: Arc::new(ConnectionSlot::new(client)),
            prefix: String::new(),
            #[cfg(feature = "nightly-candles-read-pool")]
            candles_read_pool: None,
        }
    }

    #[cfg(feature = "nightly-candles-read-pool")]
    pub(crate) fn store_with_candles_read_pool(&self, connections: usize) -> RedisStore {
        let mut store = self.store();
        let client = store.read.client.clone();
        store.candles_read_pool = Some(Arc::new(super::CandlesReadPool::new(client, connections)));
        store
    }

    pub(crate) fn fail(&self, command: &str, key: &str, failure: Failure) {
        self.data
            .lock()
            .unwrap()
            .failures
            .entry((command.into(), key.into()))
            .or_default()
            .push_back(failure);
    }

    pub(crate) fn commands(&self) -> Vec<Vec<String>> {
        std::mem::take(&mut self.data.lock().unwrap().commands)
    }

    #[cfg(feature = "nightly-candles-read-pool")]
    pub(crate) fn delayed_in_flight(&self) -> usize {
        self.data.lock().unwrap().delayed_in_flight
    }
}

#[cfg(feature = "nightly-candles-read-pool")]
impl RedisStore {
    pub(crate) async fn lock_legacy_read_for_test(
        &self,
    ) -> tokio::sync::MutexGuard<'_, Option<super::ClusterConnection>> {
        self.read.conn.lock().await
    }
}

impl Drop for RedisFixture {
    fn drop(&mut self) {
        self.server.abort();
    }
}

async fn read_command(reader: &mut BufReader<TcpStream>) -> Option<Vec<String>> {
    let mut line = String::new();
    if reader.read_line(&mut line).await.ok()? == 0 {
        return None;
    }
    let count = line.trim().strip_prefix('*')?.parse::<usize>().ok()?;
    let mut args = Vec::with_capacity(count);
    for _ in 0..count {
        line.clear();
        reader.read_line(&mut line).await.ok()?;
        let length = line.trim().strip_prefix('$')?.parse::<usize>().ok()?;
        let mut bytes = vec![0; length + 2];
        reader.read_exact(&mut bytes).await.ok()?;
        bytes.truncate(length);
        args.push(String::from_utf8(bytes).ok()?);
    }
    Some(args)
}

fn bulk(value: &str) -> String {
    format!("${}\r\n{value}\r\n", value.len())
}

fn array(values: impl IntoIterator<Item = String>) -> String {
    let values: Vec<_> = values.into_iter().collect();
    format!(
        "*{}\r\n{}",
        values.len(),
        values.iter().map(|v| bulk(v)).collect::<String>()
    )
}

fn respond(args: &[String], port: u16, data: &mut Data) -> Option<(String, Duration)> {
    data.commands.push(args.to_vec());
    let command = args[0].as_str();
    let key = args.get(1).map(String::as_str).unwrap_or("");
    let delay = match data
        .failures
        .get_mut(&(command.into(), key.into()))
        .and_then(VecDeque::pop_front)
    {
        Some(Failure::Error) => {
            return Some(("-WRONGTYPE fixture error\r\n".into(), Duration::ZERO));
        }
        Some(Failure::Disconnect) => return None,
        #[cfg(feature = "nightly-candles-read-pool")]
        Some(Failure::Delay(duration)) => {
            if !duration.is_zero() {
                data.delayed_in_flight += 1;
            }
            duration
        }
        None => Duration::ZERO,
    };
    let response = match command {
        "PING" => "+PONG\r\n".into(),
        "CLIENT" | "READONLY" => "+OK\r\n".into(),
        "CLUSTER" => format!("*1\r\n*3\r\n:0\r\n:16383\r\n*2\r\n$9\r\n127.0.0.1\r\n:{port}\r\n"),
        "SET" => {
            data.strings.insert(key.into(), args[2].clone());
            "+OK\r\n".into()
        }
        "GET" => data
            .strings
            .get(key)
            .map(|v| bulk(v))
            .unwrap_or("$-1\r\n".into()),
        "HGETALL" => "*0\r\n".into(),
        "ZADD" => {
            let zset = data.zsets.entry(key.into()).or_default();
            for pair in args[2..].chunks_exact(2) {
                zset.insert(pair[0].parse::<f64>().unwrap() as i64, pair[1].clone());
            }
            ":1\r\n".into()
        }
        "ZREMRANGEBYSCORE" => {
            let min = score(&args[2]);
            let max = score(&args[3]);
            if let Some(zset) = data.zsets.get_mut(key) {
                zset.retain(|day, _| {
                    let day = *day as f64;
                    day < min
                        || day > max
                        || (args[2].starts_with('(') && day == min)
                        || (args[3].starts_with('(') && day == max)
                });
            }
            ":1\r\n".into()
        }
        "ZREVRANGE" => {
            let values: Vec<_> = data
                .zsets
                .get(key)
                .into_iter()
                .flat_map(|z| z.values().rev())
                .cloned()
                .collect();
            let start = args[2].parse::<usize>().unwrap();
            let stop = args[3].parse::<isize>().unwrap();
            let count = if stop < 0 {
                values.len()
            } else {
                (stop as usize + 1).saturating_sub(start)
            };
            array(values.into_iter().skip(start).take(count))
        }
        "ZRANGEBYSCORE" => {
            let min = score(&args[2]);
            let max = score(&args[3]);
            let values = data
                .zsets
                .get(key)
                .into_iter()
                .flat_map(|z| z.iter())
                .filter(|(day, _)| (**day as f64) >= min && (**day as f64) <= max)
                .map(|(_, value)| value.clone());
            let offset = args.get(5).and_then(|v| v.parse().ok()).unwrap_or(0);
            let limit = args
                .get(6)
                .and_then(|v| v.parse().ok())
                .unwrap_or(usize::MAX);
            array(values.skip(offset).take(limit))
        }
        _ => panic!("unsupported fixture command: {args:?}"),
    };
    Some((response, delay))
}

fn score(value: &str) -> f64 {
    match value {
        "-inf" => f64::NEG_INFINITY,
        "+inf" => f64::INFINITY,
        value => value.trim_start_matches('(').parse().unwrap(),
    }
}

async fn serve(stream: TcpStream, port: u16, data: Arc<Mutex<Data>>) {
    let mut reader = BufReader::new(stream);
    while let Some(args) = read_command(&mut reader).await {
        let response = respond(&args, port, &mut data.lock().unwrap());
        let Some((response, delay)) = response else {
            return;
        };
        if !delay.is_zero() {
            tokio::time::sleep(delay).await;
            data.lock().unwrap().delayed_in_flight -= 1;
        }
        if reader
            .get_mut()
            .write_all(response.as_bytes())
            .await
            .is_err()
        {
            return;
        }
    }
}

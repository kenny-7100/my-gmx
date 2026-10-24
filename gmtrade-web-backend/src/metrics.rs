use std::time::Duration;

use eyre::{eyre, Result};

use crate::{config::MetricsConfig, health::Health};

pub(crate) mod critical_path;

pub(crate) use critical_path::*;

const HEARTBEAT: &str = "gmtrade_web_backend.heartbeat";
const DOGSTATSD_FLUSH_INTERVAL: Duration = Duration::from_secs(10);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum MetricsExporter {
    Prometheus,
    DogStatsd,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct PreparedMetrics {
    exporter: MetricsExporter,
    heartbeat_period: Duration,
}

pub(crate) fn install_if_enabled(config: &MetricsConfig) -> Result<Option<Duration>> {
    if !config.enabled {
        return Ok(None);
    }

    let prepared = prepare(config)?;
    install_exporter(config, prepared.exporter)?;
    enable_critical_path();
    Ok(Some(prepared.heartbeat_period))
}

fn prepare(config: &MetricsConfig) -> Result<PreparedMetrics> {
    let exporter = match config.exporter.as_str() {
        "prometheus" => MetricsExporter::Prometheus,
        "dogstatsd" => MetricsExporter::DogStatsd,
        other => return Err(eyre!("unknown metrics exporter: {other}")),
    };

    if config.heartbeat_interval_secs == 0 {
        return Err(eyre!(
            "metrics heartbeat interval must be greater than zero"
        ));
    }

    Ok(PreparedMetrics {
        exporter,
        heartbeat_period: Duration::from_secs(config.heartbeat_interval_secs),
    })
}

fn install_exporter(config: &MetricsConfig, exporter: MetricsExporter) -> Result<()> {
    match exporter {
        MetricsExporter::Prometheus => {
            metrics_exporter_prometheus::PrometheusBuilder::new()
                .with_http_listener(([0, 0, 0, 0], config.port))
                .install()
                .map_err(|error| eyre!("failed to install prometheus exporter: {error}"))?;
            tracing::info!(port = config.port, "prometheus metrics exporter started");
        }
        MetricsExporter::DogStatsd => {
            metrics_exporter_dogstatsd::DogStatsDBuilder::default()
                .with_remote_address(&config.dogstatsd_address)
                .map_err(|error| eyre!("invalid dogstatsd address: {error}"))?
                .with_flush_interval(DOGSTATSD_FLUSH_INTERVAL)
                .install()
                .map_err(|error| eyre!("failed to install dogstatsd exporter: {error}"))?;
            tracing::info!(
                address = %config.dogstatsd_address,
                "dogstatsd metrics exporter started"
            );
        }
    }

    Ok(())
}

fn heartbeat_value_at(health: &Health, now: i64) -> f64 {
    if health.is_fresh_now(now) {
        1.0
    } else {
        0.0
    }
}

fn set_heartbeat(value: f64) {
    ::metrics::gauge!(HEARTBEAT).set(value);
}

pub(crate) async fn run_heartbeat(health: Health, period: Duration) {
    let mut interval = tokio::time::interval(period);
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

    loop {
        interval.tick().await;
        set_heartbeat(heartbeat_value_at(&health, crate::util::now_unix()));
    }
}

#[cfg(test)]
mod tests {
    use std::{
        net::{TcpListener, UdpSocket},
        sync::{atomic::Ordering, Arc, Mutex},
        time::Instant,
    };

    use ::metrics::{
        Counter, Gauge, GaugeFn, Histogram, Key, KeyName, Metadata, Recorder, SharedString, Unit,
    };

    use super::*;

    fn enabled_config(exporter: &str) -> MetricsConfig {
        MetricsConfig {
            enabled: true,
            exporter: exporter.to_string(),
            ..MetricsConfig::default()
        }
    }

    #[test]
    fn prepare_accepts_supported_exporters() {
        let prometheus = prepare(&enabled_config("prometheus")).unwrap();
        assert_eq!(prometheus.exporter, MetricsExporter::Prometheus);
        assert_eq!(prometheus.heartbeat_period, Duration::from_secs(10));

        let dogstatsd = prepare(&enabled_config("dogstatsd")).unwrap();
        assert_eq!(dogstatsd.exporter, MetricsExporter::DogStatsd);
        assert_eq!(dogstatsd.heartbeat_period, Duration::from_secs(10));
    }

    #[test]
    fn prepare_rejects_tcp_and_unknown_exporters() {
        for exporter in ["tcp", "unknown"] {
            let error = prepare(&enabled_config(exporter)).unwrap_err();
            assert_eq!(
                error.to_string(),
                format!("unknown metrics exporter: {exporter}")
            );
        }
    }

    #[test]
    fn prepare_rejects_zero_heartbeat_interval() {
        let mut config = enabled_config("prometheus");
        config.heartbeat_interval_secs = 0;

        let error = prepare(&config).unwrap_err();
        assert_eq!(
            error.to_string(),
            "metrics heartbeat interval must be greater than zero"
        );
    }

    #[test]
    fn runtime_off_bypasses_validation_and_installation() {
        let config = MetricsConfig {
            enabled: false,
            exporter: "tcp".to_string(),
            dogstatsd_address: "not an address".to_string(),
            heartbeat_interval_secs: 0,
            ..MetricsConfig::default()
        };

        assert_eq!(install_if_enabled(&config).unwrap(), None);
    }

    #[test]
    fn heartbeat_value_maps_never_ticked_fresh_threshold_and_stale() {
        let health = Health::new(30);
        assert_eq!(heartbeat_value_at(&health, 100), 0.0);

        health.last_tick.store(90, Ordering::Relaxed);
        assert_eq!(heartbeat_value_at(&health, 100), 1.0);

        health.last_tick.store(70, Ordering::Relaxed);
        assert_eq!(heartbeat_value_at(&health, 100), 1.0);

        health.last_tick.store(69, Ordering::Relaxed);
        assert_eq!(heartbeat_value_at(&health, 100), 0.0);
    }

    #[derive(Debug, Clone, PartialEq)]
    struct GaugeEvent {
        name: String,
        labels: Vec<(String, String)>,
        value: f64,
    }

    struct RecordingGauge {
        name: String,
        labels: Vec<(String, String)>,
        events: Arc<Mutex<Vec<GaugeEvent>>>,
    }

    impl RecordingGauge {
        fn record(&self, value: f64) {
            self.events.lock().unwrap().push(GaugeEvent {
                name: self.name.clone(),
                labels: self.labels.clone(),
                value,
            });
        }
    }

    impl GaugeFn for RecordingGauge {
        fn increment(&self, value: f64) {
            self.record(value);
        }

        fn decrement(&self, value: f64) {
            self.record(-value);
        }

        fn set(&self, value: f64) {
            self.record(value);
        }
    }

    #[derive(Default)]
    struct RecordingRecorder {
        events: Arc<Mutex<Vec<GaugeEvent>>>,
    }

    impl Recorder for RecordingRecorder {
        fn describe_counter(&self, _key: KeyName, _unit: Option<Unit>, _description: SharedString) {
        }

        fn describe_gauge(&self, _key: KeyName, _unit: Option<Unit>, _description: SharedString) {}

        fn describe_histogram(
            &self,
            _key: KeyName,
            _unit: Option<Unit>,
            _description: SharedString,
        ) {
        }

        fn register_counter(&self, _key: &Key, _metadata: &Metadata<'_>) -> Counter {
            Counter::noop()
        }

        fn register_gauge(&self, key: &Key, _metadata: &Metadata<'_>) -> Gauge {
            let labels = key
                .labels()
                .map(|label| (label.key().to_string(), label.value().to_string()))
                .collect();
            Gauge::from_arc(Arc::new(RecordingGauge {
                name: key.name().to_string(),
                labels,
                events: Arc::clone(&self.events),
            }))
        }

        fn register_histogram(&self, _key: &Key, _metadata: &Metadata<'_>) -> Histogram {
            Histogram::noop()
        }
    }

    async fn wait_for_events(events: &Arc<Mutex<Vec<GaugeEvent>>>, expected: usize) {
        for _ in 0..20 {
            if events.lock().unwrap().len() >= expected {
                return;
            }
            tokio::task::yield_now().await;
        }
        panic!(
            "timed out waiting for {expected} gauge events; captured {}",
            events.lock().unwrap().len()
        );
    }

    #[tokio::test(flavor = "current_thread", start_paused = true)]
    async fn heartbeat_worker_emits_current_freshness_without_labels() {
        let recorder = RecordingRecorder::default();
        let events = Arc::clone(&recorder.events);
        let _guard = ::metrics::set_default_local_recorder(&recorder);
        let health = Health::new(5);
        let period = Duration::from_secs(10);
        let worker = tokio::spawn(run_heartbeat(health.clone(), period));

        wait_for_events(&events, 1).await;

        health
            .last_tick
            .store(crate::util::now_unix(), Ordering::Relaxed);
        tokio::time::advance(period).await;
        wait_for_events(&events, 2).await;

        health
            .last_tick
            .store(crate::util::now_unix() - 6, Ordering::Relaxed);
        tokio::time::advance(period).await;
        wait_for_events(&events, 3).await;

        worker.abort();
        let _ = worker.await;

        assert_eq!(
            *events.lock().unwrap(),
            [
                GaugeEvent {
                    name: HEARTBEAT.to_string(),
                    labels: Vec::new(),
                    value: 0.0,
                },
                GaugeEvent {
                    name: HEARTBEAT.to_string(),
                    labels: Vec::new(),
                    value: 1.0,
                },
                GaugeEvent {
                    name: HEARTBEAT.to_string(),
                    labels: Vec::new(),
                    value: 0.0,
                },
            ]
        );
    }

    #[tokio::test(flavor = "current_thread")]
    #[ignore = "installs a process-wide Prometheus recorder"]
    async fn prometheus_exporter_smoke() {
        let probe = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = probe.local_addr().unwrap().port();
        drop(probe);

        let mut config = enabled_config("prometheus");
        config.port = port;
        assert_eq!(
            install_if_enabled(&config).unwrap(),
            Some(Duration::from_secs(10))
        );
        set_heartbeat(1.0);
        emit_critical_smoke_samples();

        let endpoint = format!("http://127.0.0.1:{port}");
        let client = reqwest::Client::builder().no_proxy().build().unwrap();
        let body = tokio::time::timeout(Duration::from_secs(5), async {
            loop {
                if let Ok(response) = client.get(&endpoint).send().await {
                    if response.status().is_success() {
                        let body = response.text().await.unwrap();
                        if body.contains("gmtrade_web_backend_heartbeat 1") {
                            break body;
                        }
                    }
                }
                tokio::time::sleep(Duration::from_millis(50)).await;
            }
        })
        .await
        .expect("timed out waiting for Prometheus heartbeat series");

        eprintln!("prometheus endpoint: {endpoint}\n{body}");
        assert!(body.contains("gmtrade_web_backend_heartbeat 1"));
        {
            assert!(body.lines().any(|line| line
                .starts_with("gmtrade_web_backend_http_request_duration_seconds_count{")
                && line.contains("route=\"/healthz\"")
                && line.contains("status=\"200\"")
                && line.ends_with(" 1")));
        }
    }

    fn emit_critical_smoke_samples() {
        assert!(critical_path_enabled());
        emit_http_smoke_sample();
    }

    #[test]
    #[ignore = "installs a process-wide DogStatsD recorder and waits for its production flush"]
    fn dogstatsd_exporter_smoke() {
        let receiver = UdpSocket::bind("127.0.0.1:0").unwrap();
        let address = receiver.local_addr().unwrap();

        let mut config = enabled_config("dogstatsd");
        config.dogstatsd_address = address.to_string();
        assert_eq!(
            install_if_enabled(&config).unwrap(),
            Some(Duration::from_secs(10))
        );
        set_heartbeat(1.0);
        emit_critical_smoke_samples();

        let expected = std::collections::BTreeSet::from([HEARTBEAT, HTTP_DURATION]);
        let mut received = std::collections::BTreeSet::new();

        let deadline = Instant::now() + Duration::from_secs(15);
        let mut buffer = [0_u8; 65_535];
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            assert!(
                !remaining.is_zero(),
                "timed out waiting for DogStatsD heartbeat"
            );
            receiver
                .set_read_timeout(Some(remaining.min(Duration::from_secs(1))))
                .unwrap();

            match receiver.recv_from(&mut buffer) {
                Ok((length, source)) => {
                    let packet = String::from_utf8_lossy(&buffer[..length]);
                    eprintln!("dogstatsd packet from {source}: {packet}");
                    for line in packet.lines() {
                        let Some((name, payload)) = line.split_once(':') else {
                            continue;
                        };
                        if !expected.contains(name) {
                            continue;
                        }

                        let mut fields = payload.split('|');
                        let value: f64 = fields.next().unwrap().parse().unwrap();
                        let kind = fields.next().unwrap();
                        match name {
                            HEARTBEAT => {
                                assert_eq!(kind, "g");
                                assert_eq!(value, 1.0);
                            }
                            HTTP_DURATION => {
                                assert_eq!(kind, "d");
                                assert!(line.contains("route:/healthz"));
                                assert!(line.contains("status:200"));
                            }
                            _ => unreachable!(),
                        }
                        received.insert(name.to_string());
                        if expected.iter().all(|name| received.contains(*name)) {
                            return;
                        }
                    }
                }
                Err(error)
                    if matches!(
                        error.kind(),
                        std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
                    ) => {}
                Err(error) => panic!("failed to receive DogStatsD packet: {error}"),
            }
        }
    }
}

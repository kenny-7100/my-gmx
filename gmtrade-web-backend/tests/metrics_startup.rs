use std::{
    io::Read,
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};

#[test]
#[ignore = "spawns the real service binary to verify startup failure"]
fn unsupported_tcp_exits_before_business_initialization() {
    let mut command = Command::new(env!("CARGO_BIN_EXE_gmtrade-web-backend"));
    for (key, _) in std::env::vars_os() {
        if key.to_string_lossy().starts_with("GMSOL_WEB_") {
            command.env_remove(key);
        }
    }
    command
        .env("GMSOL_WEB_METRICS__ENABLED", "true")
        .env("GMSOL_WEB_METRICS__EXPORTER", "tcp")
        .stdout(Stdio::null())
        .stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .expect("failed to spawn gmtrade-web-backend child");
    let deadline = Instant::now() + Duration::from_secs(5);
    let mut timed_out = false;
    let status = loop {
        match child.try_wait().expect("failed to poll child process") {
            Some(status) => break status,
            None if Instant::now() < deadline => thread::sleep(Duration::from_millis(10)),
            None => {
                timed_out = true;
                child.kill().expect("failed to kill timed-out child");
                break child.wait().expect("failed to reap timed-out child");
            }
        }
    };

    let mut stderr = String::new();
    child
        .stderr
        .take()
        .expect("child stderr was not piped")
        .read_to_string(&mut stderr)
        .expect("failed to read child stderr");

    assert!(!timed_out, "service did not fail fast; stderr: {stderr}");
    assert!(
        !status.success(),
        "service unexpectedly started successfully"
    );
    assert!(
        stderr.contains("unknown metrics exporter: tcp"),
        "unexpected stderr: {stderr}"
    );
}

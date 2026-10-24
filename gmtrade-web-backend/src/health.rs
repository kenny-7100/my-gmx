use axum::{extract::State, http::StatusCode};
use std::sync::atomic::{AtomicI64, Ordering};
use std::sync::Arc;

use crate::util::now_unix;

#[derive(Clone)]
pub struct Health {
    pub last_tick: Arc<AtomicI64>,
    threshold: i64,
}

impl Health {
    pub fn new(threshold_secs: u64) -> Self {
        Self {
            last_tick: Arc::new(AtomicI64::new(0)),
            threshold: threshold_secs as i64,
        }
    }
    pub fn record_tick(&self) {
        self.last_tick.store(now_unix(), Ordering::Relaxed);
    }
    pub fn is_fresh_now(&self, now: i64) -> bool {
        let last = self.last_tick.load(Ordering::Relaxed);
        last != 0 && (now - last) <= self.threshold
    }
}

// Both /healthz and /healthz/active use the same freshness gate for now.
pub async fn healthz(State(health): State<Health>) -> (StatusCode, String) {
    if health.is_fresh_now(now_unix()) {
        (StatusCode::OK, "ok".to_string())
    } else {
        let last = health.last_tick.load(Ordering::Relaxed);
        if last == 0 {
            (StatusCode::SERVICE_UNAVAILABLE, "never ticked".to_string())
        } else {
            (
                StatusCode::SERVICE_UNAVAILABLE,
                format!("stale, age={}s", now_unix() - last),
            )
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::Ordering;
    #[test]
    fn never_ticked_is_not_fresh() {
        let h = Health::new(30);
        assert!(!h.is_fresh_now(100));
    }
    #[test]
    fn fresh_within_threshold_only() {
        let h = Health::new(30);
        h.last_tick.store(90, Ordering::Relaxed);
        assert!(h.is_fresh_now(100)); // age 10 <= 30
        assert!(!h.is_fresh_now(200)); // age 110 > 30
    }
}

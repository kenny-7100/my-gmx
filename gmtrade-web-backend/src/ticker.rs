//! Shared primitives for the background refresh loops: skip-on-missed interval setup + monotonic cadence gating.

use std::time::{Duration, Instant};

/// A skip-on-missed-tick interval at `secs` (floored at 1s) for a background loop.
pub fn interval(secs: u64) -> tokio::time::Interval {
    let mut iv = tokio::time::interval(Duration::from_secs(secs.max(1)));
    iv.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    iv
}

/// Monotonic cadence gate tracking the last run, gating a dataset on its configured interval.
pub struct Cadence {
    interval: Duration,
    last_run: Option<Instant>,
}

impl Cadence {
    pub fn new(secs: u64) -> Self {
        Self {
            interval: Duration::from_secs(secs.max(1)),
            last_run: None,
        }
    }

    /// Is the dataset due now? True on the first check, then once each `interval` has elapsed.
    pub fn due(&self, now: Instant) -> bool {
        match self.last_run {
            None => true,
            Some(last) => now.duration_since(last) >= self.interval,
        }
    }

    pub fn mark(&mut self, now: Instant) {
        self.last_run = Some(now);
    }
}

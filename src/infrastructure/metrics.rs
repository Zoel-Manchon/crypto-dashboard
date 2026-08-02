use std::fmt::Write as _;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;

/// Dependency-free application metrics rendered in the Prometheus text
/// exposition format. Counters/gauges are plain atomics; `render()` builds the
/// `/metrics` body. For a single-process service this is plenty and avoids
/// pulling in (and version-pinning) a metrics crate.
pub struct AppMetrics {
    start: Instant,
    polls_ok: AtomicU64,
    polls_err: AtomicU64,
    prices_written: AtomicU64,
    discovery_ok: AtomicU64,
    discovery_err: AtomicU64,
    tracked_coins: AtomicU64,
    last_poll_ms: AtomicU64,
    http_requests: AtomicU64,
}

impl AppMetrics {
    pub fn new() -> Self {
        Self {
            start: Instant::now(),
            polls_ok: AtomicU64::new(0),
            polls_err: AtomicU64::new(0),
            prices_written: AtomicU64::new(0),
            discovery_ok: AtomicU64::new(0),
            discovery_err: AtomicU64::new(0),
            tracked_coins: AtomicU64::new(0),
            last_poll_ms: AtomicU64::new(0),
            http_requests: AtomicU64::new(0),
        }
    }

    pub fn record_poll_ok(&self, written: usize, dur_ms: u64) {
        self.polls_ok.fetch_add(1, Ordering::Relaxed);
        self.prices_written.fetch_add(written as u64, Ordering::Relaxed);
        self.last_poll_ms.store(dur_ms, Ordering::Relaxed);
    }

    pub fn record_poll_err(&self) {
        self.polls_err.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_discovery_ok(&self, coins: usize) {
        self.discovery_ok.fetch_add(1, Ordering::Relaxed);
        self.tracked_coins.store(coins as u64, Ordering::Relaxed);
    }

    pub fn record_discovery_err(&self) {
        self.discovery_err.fetch_add(1, Ordering::Relaxed);
    }

    pub fn incr_http(&self) {
        self.http_requests.fetch_add(1, Ordering::Relaxed);
    }

    /// Render the Prometheus text exposition format (content-type
    /// `text/plain; version=0.0.4`).
    pub fn render(&self) -> String {
        let uptime = self.start.elapsed().as_secs_f64();
        let last_poll = self.last_poll_ms.load(Ordering::Relaxed) as f64 / 1000.0;
        let g = |a: &AtomicU64| a.load(Ordering::Relaxed);

        let mut out = String::with_capacity(1280);
        let _ = writeln!(out, "# HELP cw_uptime_seconds Process uptime in seconds.");
        let _ = writeln!(out, "# TYPE cw_uptime_seconds gauge");
        let _ = writeln!(out, "cw_uptime_seconds {uptime}");

        let _ = writeln!(out, "# HELP cw_polls_total Provider poll cycles by result.");
        let _ = writeln!(out, "# TYPE cw_polls_total counter");
        let _ = writeln!(out, "cw_polls_total{{result=\"ok\"}} {}", g(&self.polls_ok));
        let _ = writeln!(out, "cw_polls_total{{result=\"error\"}} {}", g(&self.polls_err));

        let _ = writeln!(out, "# HELP cw_prices_written_total Price rows persisted.");
        let _ = writeln!(out, "# TYPE cw_prices_written_total counter");
        let _ = writeln!(out, "cw_prices_written_total {}", g(&self.prices_written));

        let _ = writeln!(out, "# HELP cw_discovery_total Coin discovery refreshes by result.");
        let _ = writeln!(out, "# TYPE cw_discovery_total counter");
        let _ = writeln!(out, "cw_discovery_total{{result=\"ok\"}} {}", g(&self.discovery_ok));
        let _ = writeln!(out, "cw_discovery_total{{result=\"error\"}} {}", g(&self.discovery_err));

        let _ = writeln!(out, "# HELP cw_tracked_coins Coins currently tracked.");
        let _ = writeln!(out, "# TYPE cw_tracked_coins gauge");
        let _ = writeln!(out, "cw_tracked_coins {}", g(&self.tracked_coins));

        let _ = writeln!(out, "# HELP cw_last_poll_duration_seconds Duration of the most recent poll.");
        let _ = writeln!(out, "# TYPE cw_last_poll_duration_seconds gauge");
        let _ = writeln!(out, "cw_last_poll_duration_seconds {last_poll}");

        let _ = writeln!(out, "# HELP cw_http_requests_total Total HTTP requests handled.");
        let _ = writeln!(out, "# TYPE cw_http_requests_total counter");
        let _ = writeln!(out, "cw_http_requests_total {}", g(&self.http_requests));

        out
    }
}

impl Default for AppMetrics {
    fn default() -> Self {
        Self::new()
    }
}

use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// Simple fixed-window, per-IP rate limiter. In-memory and single-instance —
/// not distributed, but it demonstrates the pattern and protects the upstream
/// provider/DB from a single abusive client.
pub struct RateLimiter {
    max_per_window: u32,
    window: Duration,
    hits: Mutex<HashMap<IpAddr, (Instant, u32)>>,
}

impl RateLimiter {
    pub fn per_minute(max: u32) -> Self {
        Self {
            max_per_window: max,
            window: Duration::from_secs(60),
            hits: Mutex::new(HashMap::new()),
        }
    }

    /// Returns true if the request from `ip` is allowed under the current window.
    pub fn check(&self, ip: IpAddr) -> bool {
        if self.max_per_window == 0 {
            return true; // disabled
        }
        let now = Instant::now();
        let mut map = self.hits.lock().expect("rate limiter lock poisoned");
        let entry = map.entry(ip).or_insert((now, 0));
        if now.duration_since(entry.0) > self.window {
            *entry = (now, 0);
        }
        entry.1 += 1;
        entry.1 <= self.max_per_window
    }
}

/** The ONE place external locations are defined.
 *
 * Every value can be overridden at build time with a PUBLIC_ env var, so the
 * same image runs against localhost, a compose network or a real deployment
 * without editing source. Defaults match the dev docker-compose. */

function env(key: string, fallback: string): string {
  const v = (import.meta.env as Record<string, string | undefined>)[key];
  return v && v.length > 0 ? v : fallback;
}

export const API_BASE_URL = env("PUBLIC_API_BASE_URL", "http://127.0.0.1:8080");
export const WS_URL = env("PUBLIC_WS_URL", "ws://127.0.0.1:8080/api/ws");
// Binance public combined-stream endpoint (no key needed) — used by the
// alternate PriceStream adapter for true sub-second trade ticks.
export const BINANCE_WS_URL = env("PUBLIC_BINANCE_WS_URL", "wss://stream.binance.com:9443");

// Observability endpoints (dev docker-compose). Adjust if hosted elsewhere.
export const METRICS_URL = `${API_BASE_URL}/metrics`;
export const HEALTH_URL = `${API_BASE_URL}/api/health`;
export const GRAFANA_URL = env("PUBLIC_GRAFANA_URL", "http://localhost:3000");
export const PROMETHEUS_URL = env("PUBLIC_PROMETHEUS_URL", "http://localhost:9090");
export const ALERTMANAGER_URL = env("PUBLIC_ALERTMANAGER_URL", "http://localhost:9093");

/** UID of the provisioned Grafana dashboard (observability/grafana/dashboards). */
export const GRAFANA_DASHBOARD_UID = env("PUBLIC_GRAFANA_DASHBOARD_UID", "crypto-watch");

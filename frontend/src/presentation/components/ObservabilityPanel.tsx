import { useCallback, useEffect, useState } from "react";
import {
  ALERTMANAGER_URL,
  GRAFANA_DASHBOARD_UID,
  GRAFANA_URL,
  HEALTH_URL,
  METRICS_URL,
  PROMETHEUS_URL,
} from "../../infrastructure/config";
import {
  parseExposition,
  pick,
  promAlerts,
  promQuery,
  promTargets,
  type FiringAlert,
  type Target,
} from "./terminal/prometheus";

/* =============================================================================
 * Ops — the observability tab.
 *
 * The stack was always in the compose file; it just lived outside the product,
 * behind five links you had to open in another window. This tab brings it in:
 *
 *   1. Service vitals, read straight from the backend's /metrics text endpoint.
 *      No monitoring stack needed — the service reports on itself.
 *   2. Prometheus: scrape-target health, firing rules, and a handful of rate()
 *      queries the raw counters can't answer.
 *   3. Grafana: the provisioned dashboard, embedded in kiosk mode.
 *
 * Each section fails independently and says which piece is down, because "the
 * chart is empty" and "Prometheus is unreachable" are different problems.
 * ========================================================================== */

const REFRESH_MS = 10_000;

/** rate() over the last 5 minutes — the questions counters alone can't answer. */
const RATE_QUERIES = [
  { label: "Poll cycles / min", expr: 'sum(rate(cw_polls_total[5m])) * 60', unit: "" },
  { label: "Poll errors / min", expr: 'sum(rate(cw_polls_total{result="error"}[5m])) * 60', unit: "" },
  { label: "Prices written / min", expr: "sum(rate(cw_prices_written_total[5m])) * 60", unit: "" },
  { label: "HTTP req / min", expr: "sum(rate(cw_http_requests_total[5m])) * 60", unit: "" },
] as const;

function Cell({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="cw-kpi">
      <div className="label">{label}</div>
      <div className="cw-kpi__value" style={{ color: color ?? "var(--cw-fg)", fontSize: 26 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--cw-dim)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function duration(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${Math.floor(seconds % 60)}s`;
}

export default function ObservabilityPanel() {
  const [vitals, setVitals] = useState<Record<string, number | null> | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [healthy, setHealthy] = useState<boolean | null>(null);

  const [targets, setTargets] = useState<Target[]>([]);
  const [alerts, setAlerts] = useState<FiringAlert[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [promError, setPromError] = useState<string | null>(null);

  const [showGrafana, setShowGrafana] = useState(true);

  /* --- 1. the service talking about itself ------------------------------ */
  const loadMetrics = useCallback(async (signal: AbortSignal) => {
    try {
      const res = await fetch(METRICS_URL, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const samples = parseExposition(await res.text());
      setVitals({
        uptime: pick(samples, "cw_uptime_seconds"),
        coins: pick(samples, "cw_tracked_coins"),
        pollsOk: pick(samples, "cw_polls_total", { result: "ok" }),
        pollsErr: pick(samples, "cw_polls_total", { result: "error" }),
        written: pick(samples, "cw_prices_written_total"),
        lastPoll: pick(samples, "cw_last_poll_duration_seconds"),
        http: pick(samples, "cw_http_requests_total"),
        discoveryErr: pick(samples, "cw_discovery_total", { result: "error" }),
      });
      setMetricsError(null);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setMetricsError("Can't reach the backend's /metrics endpoint.");
    }
    try {
      const res = await fetch(HEALTH_URL, { signal });
      setHealthy(res.ok);
    } catch {
      setHealthy(false);
    }
  }, []);

  /* --- 2. Prometheus ---------------------------------------------------- */
  const loadProm = useCallback(async (signal: AbortSignal) => {
    try {
      const [ts, as, ...rs] = await Promise.all([
        promTargets(signal),
        promAlerts(signal),
        ...RATE_QUERIES.map((q) => promQuery(q.expr, signal)),
      ]);
      setTargets(ts);
      setAlerts(as);
      const next: Record<string, number> = {};
      RATE_QUERIES.forEach((q, i) => {
        const v = rs[i]?.[0]?.value?.[1];
        if (v !== undefined) next[q.label] = Number(v);
      });
      setRates(next);
      setPromError(null);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setPromError(
        "Prometheus isn't answering. Start the stack with `docker compose up -d prometheus grafana alertmanager`.",
      );
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void loadMetrics(ctrl.signal);
    void loadProm(ctrl.signal);
    const t = window.setInterval(() => {
      void loadMetrics(ctrl.signal);
      void loadProm(ctrl.signal);
    }, REFRESH_MS);
    return () => {
      ctrl.abort();
      window.clearInterval(t);
    };
  }, [loadMetrics, loadProm]);

  const pollsErr = vitals?.pollsErr ?? 0;
  const grafanaSrc = `${GRAFANA_URL}/d/${GRAFANA_DASHBOARD_UID}/?kiosk&refresh=10s`;

  return (
    <div>
      {/* ── service vitals ── */}
      <div className="cw-head">
        <span>Service vitals · backend /metrics</span>
        <span style={{ color: healthy === false ? "var(--cw-down)" : "var(--cw-dim)" }}>
          {healthy === null ? "checking…" : healthy ? "health ok" : "health failing"} · refresh {REFRESH_MS / 1000}s
        </span>
      </div>

      {metricsError ? (
        <div className="cw-body" style={{ color: "var(--cw-down)" }}>
          {metricsError} The backend exposes it at <code>{METRICS_URL}</code>.
        </div>
      ) : (
        <div
          className="grid"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            borderBottom: "2px solid var(--cw-line)",
          }}
        >
          <Cell label="Uptime" value={vitals?.uptime != null ? duration(vitals.uptime) : "—"} sub="since boot" />
          <Cell label="Tracked coins" value={vitals?.coins != null ? String(vitals.coins) : "—"} sub="discovery" />
          <Cell
            label="Poll cycles"
            value={vitals?.pollsOk != null ? vitals.pollsOk.toLocaleString() : "—"}
            sub="successful"
          />
          <Cell
            label="Poll errors"
            value={String(pollsErr)}
            sub="provider failures"
            color={pollsErr > 0 ? "var(--cw-down)" : "var(--cw-fg)"}
          />
          <Cell
            label="Prices written"
            value={vitals?.written != null ? vitals.written.toLocaleString() : "—"}
            sub="rows persisted"
          />
          <Cell
            label="Last poll"
            value={vitals?.lastPoll != null ? `${(vitals.lastPoll * 1000).toFixed(0)}ms` : "—"}
            sub="provider latency"
          />
          <Cell
            label="HTTP requests"
            value={vitals?.http != null ? vitals.http.toLocaleString() : "—"}
            sub="served"
          />
        </div>
      )}

      {/* ── prometheus ── */}
      <div className="cw-split" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <section className="min-w-0">
          <div className="cw-head">
            <span>Prometheus · rates</span>
            <a href={PROMETHEUS_URL} target="_blank" rel="noopener noreferrer" className="cw-chip">
              Open ↗
            </a>
          </div>
          {promError ? (
            <div className="cw-body" style={{ color: "var(--cw-dim)", fontSize: 11, lineHeight: 1.6 }}>
              {promError}
            </div>
          ) : (
            <div className="cw-body flex flex-col gap-2.5">
              {RATE_QUERIES.map((q) => {
                const v = rates[q.label];
                const bad = q.label.includes("errors") && v > 0;
                return (
                  <div key={q.label} className="flex items-baseline justify-between gap-3">
                    <span className="label" style={{ letterSpacing: "0.12em" }}>
                      {q.label}
                    </span>
                    <span
                      style={{
                        fontSize: 18,
                        fontWeight: 800,
                        color: bad ? "var(--cw-down)" : "var(--cw-fg)",
                      }}
                    >
                      {v === undefined ? "—" : v.toFixed(2)}
                    </span>
                  </div>
                );
              })}
              <p style={{ fontSize: 10, color: "var(--cw-dim2)", marginTop: 4 }}>
                Instant queries over a 5-minute window, evaluated by Prometheus — not by the browser.
              </p>
            </div>
          )}
        </section>

        <section className="min-w-0">
          <div className="cw-head">
            <span>Scrape targets</span>
            <span style={{ color: "var(--cw-dim)" }}>{targets.length} active</span>
          </div>
          {targets.length === 0 ? (
            <div className="cw-body label">No targets reported.</div>
          ) : (
            <table className="cw-table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Instance</th>
                  <th style={{ textAlign: "right" }}>Health</th>
                </tr>
              </thead>
              <tbody>
                {targets.map((t) => (
                  <tr key={`${t.job}-${t.instance}`}>
                    <td style={{ fontWeight: 800 }}>{t.job}</td>
                    <td style={{ color: "var(--cw-dim)" }}>{t.instance}</td>
                    <td
                      style={{
                        textAlign: "right",
                        fontWeight: 800,
                        color: t.health === "up" ? "var(--cw-up)" : "var(--cw-down)",
                      }}
                      title={t.lastError || undefined}
                    >
                      {t.health.toUpperCase()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {/* ── alerts ── */}
      <section style={{ borderBottom: "2px solid var(--cw-line)" }}>
        <div className="cw-head">
          <span>Alert rules</span>
          <a href={ALERTMANAGER_URL} target="_blank" rel="noopener noreferrer" className="cw-chip">
            Alertmanager ↗
          </a>
        </div>
        {alerts.length === 0 ? (
          <div className="cw-body label">
            {promError ? "Unavailable while Prometheus is down." : "Nothing pending or firing. System nominal."}
          </div>
        ) : (
          <table className="cw-table">
            <thead>
              <tr>
                <th>Alert</th>
                <th>Severity</th>
                <th>Summary</th>
                <th style={{ textAlign: "right" }}>State</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a, i) => (
                <tr key={`${a.name}-${i}`}>
                  <td style={{ fontWeight: 800 }}>{a.name}</td>
                  <td style={{ color: "var(--cw-dim)" }}>{a.severity}</td>
                  <td style={{ color: "var(--cw-dim)" }}>{a.summary}</td>
                  <td
                    style={{
                      textAlign: "right",
                      fontWeight: 800,
                      color: a.state === "firing" ? "var(--cw-down)" : "var(--cw-accent)",
                    }}
                  >
                    {a.state.toUpperCase()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ── grafana ── */}
      <section>
        <div className="cw-head">
          <span>Grafana · crypto·watch backend</span>
          <span className="flex items-center gap-2">
            <button
              className="cw-chip"
              aria-pressed={showGrafana}
              onClick={() => setShowGrafana((v) => !v)}
            >
              {showGrafana ? "Hide" : "Show"}
            </button>
            <a href={grafanaSrc} target="_blank" rel="noopener noreferrer" className="cw-chip">
              Open ↗
            </a>
          </span>
        </div>
        {showGrafana ? (
          <iframe
            title="Grafana — crypto·watch backend"
            src={grafanaSrc}
            style={{ width: "100%", height: 720, border: 0, display: "block", background: "var(--cw-panel)" }}
          />
        ) : (
          <div className="cw-body label">Panel hidden.</div>
        )}
        <div className="cw-body" style={{ fontSize: 11, color: "var(--cw-dim)", borderTop: "1px solid var(--cw-grid)" }}>
          Embedded in kiosk mode as the anonymous Viewer the compose file provisions. If the frame stays
          blank, Grafana is refusing to be framed — check <code>GF_SECURITY_ALLOW_EMBEDDING=true</code>.
        </div>
      </section>
    </div>
  );
}

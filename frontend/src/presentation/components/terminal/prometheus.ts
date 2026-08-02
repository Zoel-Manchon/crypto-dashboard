/** Minimal Prometheus clients — no SDK, no extra dependency.
 *
 * Two sources, deliberately kept separate:
 *   - the backend's own /metrics text endpoint, which works even when the
 *     monitoring stack is down (it is just the service talking about itself);
 *   - the Prometheus HTTP API, which adds history, rates and target health.
 * The Ops tab degrades to the first when the second is unreachable. */

import { PROMETHEUS_URL } from "../../../infrastructure/config";

export interface Sample {
  name: string;
  labels: Record<string, string>;
  value: number;
}

/** Parses the Prometheus text exposition format (0.0.4). */
export function parseExposition(text: string): Sample[] {
  const out: Sample[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{[^}]*\})?\s+(-?[0-9.eE+]+|NaN)$/.exec(line);
    if (!m) continue;
    const labels: Record<string, string> = {};
    if (m[2]) {
      for (const pair of m[2].slice(1, -1).split(",")) {
        const eq = pair.indexOf("=");
        if (eq === -1) continue;
        labels[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim().replace(/^"|"$/g, "");
      }
    }
    out.push({ name: m[1], labels, value: Number(m[3]) });
  }
  return out;
}

export function pick(samples: Sample[], name: string, labels: Record<string, string> = {}): number | null {
  const hit = samples.find(
    (s) => s.name === name && Object.entries(labels).every(([k, v]) => s.labels[k] === v),
  );
  return hit ? hit.value : null;
}

interface PromVector {
  status: string;
  data: { resultType: string; result: { metric: Record<string, string>; value: [number, string] }[] };
}

/** Instant query against the Prometheus HTTP API. */
export async function promQuery(expr: string, signal?: AbortSignal): Promise<PromVector["data"]["result"]> {
  const url = `${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(expr)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`prometheus query failed: ${res.status}`);
  const body = (await res.json()) as PromVector;
  if (body.status !== "success") throw new Error("prometheus returned an error");
  return body.data.result;
}

export interface Target {
  job: string;
  instance: string;
  health: string;
  lastError: string;
  lastScrape: string;
}

/** Scrape-target health — the fastest way to see the pipeline is actually wired. */
export async function promTargets(signal?: AbortSignal): Promise<Target[]> {
  const res = await fetch(`${PROMETHEUS_URL}/api/v1/targets?state=any`, { signal });
  if (!res.ok) throw new Error(`prometheus targets failed: ${res.status}`);
  const body = (await res.json()) as {
    data: { activeTargets: { labels: Record<string, string>; health: string; lastError: string; lastScrape: string }[] };
  };
  return body.data.activeTargets.map((t) => ({
    job: t.labels.job ?? "—",
    instance: t.labels.instance ?? "—",
    health: t.health,
    lastError: t.lastError,
    lastScrape: t.lastScrape,
  }));
}

export interface FiringAlert {
  name: string;
  state: string;
  severity: string;
  summary: string;
  activeAt: string;
}

/** Alert rules currently pending or firing, straight from Prometheus. */
export async function promAlerts(signal?: AbortSignal): Promise<FiringAlert[]> {
  const res = await fetch(`${PROMETHEUS_URL}/api/v1/alerts`, { signal });
  if (!res.ok) throw new Error(`prometheus alerts failed: ${res.status}`);
  const body = (await res.json()) as {
    data: { alerts: { labels: Record<string, string>; annotations: Record<string, string>; state: string; activeAt: string }[] };
  };
  return body.data.alerts.map((a) => ({
    name: a.labels.alertname ?? "—",
    state: a.state,
    severity: a.labels.severity ?? "—",
    summary: a.annotations.summary ?? a.annotations.description ?? "",
    activeAt: a.activeAt,
  }));
}

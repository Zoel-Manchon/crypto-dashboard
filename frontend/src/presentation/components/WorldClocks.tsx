import { useEffect, useState } from "react";
import { useLocalState } from "../hooks/useLocalState";

/** Catalog of selectable market clocks. */
const CATALOG = [
  { label: "New York", code: "NYC", tz: "America/New_York" },
  { label: "London", code: "LDN", tz: "Europe/London" },
  { label: "Tokyo", code: "TYO", tz: "Asia/Tokyo" },
  { label: "Madrid", code: "MAD", tz: "Europe/Madrid" },
  { label: "Moscow", code: "MOW", tz: "Europe/Moscow" },
  { label: "Berlin", code: "BER", tz: "Europe/Berlin" },
  { label: "Zurich", code: "ZRH", tz: "Europe/Zurich" },
  { label: "Dubai", code: "DXB", tz: "Asia/Dubai" },
  { label: "Singapore", code: "SIN", tz: "Asia/Singapore" },
  { label: "Hong Kong", code: "HKG", tz: "Asia/Hong_Kong" },
  { label: "Shanghai", code: "SHA", tz: "Asia/Shanghai" },
  { label: "Sydney", code: "SYD", tz: "Australia/Sydney" },
  { label: "São Paulo", code: "SAO", tz: "America/Sao_Paulo" },
  { label: "San Francisco", code: "SFO", tz: "America/Los_Angeles" },
] as const;

const DEFAULT_CODES = ["NYC", "LDN", "TYO", "MAD", "MOW"];
const MAX_CLOCKS = 8;

function timeIn(tz: string, date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function secondsIn(tz: string, date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, second: "2-digit" }).format(date);
}

function dayIn(tz: string, date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short" })
    .format(date)
    .toUpperCase();
}

/**
 * Configurable market clocks.
 *
 * The header carries four fixed venues as chrome; this is the set you choose —
 * up to 8 from the catalog, persisted and synced with the rest of your account
 * preferences under `cw:clocks`.
 *
 * Laid out as flush cells sharing hairlines, like every other region of the
 * terminal. The seconds are deliberately smaller and dimmer than the hours and
 * minutes: they move constantly, and at equal weight they'd pull the eye away
 * from the part you actually read.
 */
export default function WorldClocks() {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date>(new Date());
  const [editing, setEditing] = useState(false);
  // Persisted selection of clock codes, in display order.
  const [codes, setCodes] = useLocalState<string[]>("cw:clocks", DEFAULT_CODES);

  useEffect(() => {
    setMounted(true);
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const zones = codes
    .map((c) => CATALOG.find((z) => z.code === c))
    .filter((z): z is (typeof CATALOG)[number] => Boolean(z));

  function toggle(code: string) {
    setCodes((prev) => {
      if (prev.includes(code)) {
        return prev.length > 1 ? prev.filter((c) => c !== code) : prev; // keep ≥1
      }
      return prev.length < MAX_CLOCKS ? [...prev, code] : prev;
    });
  }

  return (
    <section aria-label="World market clocks">
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-2"
        style={{ borderBottom: "1px solid var(--cw-grid)" }}
      >
        <button
          onClick={() => setEditing((e) => !e)}
          className="cw-chip"
          aria-pressed={editing}
          title="Choose which market clocks to show"
        >
          {editing ? "✓ Done" : "⚙ Edit"}
        </button>
        <span
          className="flex items-center gap-2"
          style={{
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--cw-dim)",
          }}
        >
          <span
            className="blip"
            style={{ width: 7, height: 7, background: "var(--cw-up)" }}
            aria-hidden
          />
          Live UTC sync
        </span>
      </div>

      {editing && (
        <div
          className="flex flex-wrap items-center gap-1 px-4 py-3"
          style={{ borderBottom: "1px solid var(--cw-grid)", background: "var(--cw-grid)" }}
        >
          {CATALOG.map((z) => {
            const on = codes.includes(z.code);
            return (
              <button
                key={z.code}
                onClick={() => toggle(z.code)}
                className="cw-chip"
                aria-pressed={on}
                title={z.label}
                style={{ background: on ? undefined : "var(--cw-panel)" }}
              >
                {z.code}
              </button>
            );
          })}
          <span
            className="ml-2"
            style={{
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--cw-dim2)",
            }}
          >
            {codes.length}/{MAX_CLOCKS} selected
          </span>
        </div>
      )}

      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}
      >
        {zones.map((z) => (
          <article
            key={z.tz}
            style={{
              padding: "12px 16px",
              borderRight: "1px solid var(--cw-grid)",
              borderBottom: "1px solid var(--cw-grid)",
              minWidth: 0,
            }}
          >
            <div
              className="flex items-baseline justify-between gap-2"
              style={{
                fontSize: 9,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--cw-dim)",
              }}
            >
              <span style={{ color: "var(--cw-accent)", fontWeight: 800 }}>{z.code}</span>
              <span>{mounted ? dayIn(z.tz, now) : "—"}</span>
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: "-0.03em",
                marginTop: 2,
              }}
            >
              {mounted ? timeIn(z.tz, now) : "--:--"}
              <span style={{ fontSize: 13, color: "var(--cw-dim)", marginLeft: 4 }}>
                :{mounted ? secondsIn(z.tz, now) : "--"}
              </span>
            </div>
            <p
              style={{
                margin: "2px 0 0",
                fontSize: 11,
                color: "var(--cw-dim)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {z.label}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

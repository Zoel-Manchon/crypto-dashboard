import { useMemo, useState } from "react";
import { useCoins } from "../../hooks/useCoins";
import { useLivePrices } from "../../hooks/useLivePrices";
import { useTickRate } from "../../hooks/useTickRate";
import { setFeedPaused } from "../../../infrastructure/websocket/feed-gate";
import {
  ALERTMANAGER_URL,
  GRAFANA_URL,
  HEALTH_URL,
  METRICS_URL,
  PROMETHEUS_URL,
} from "../../../infrastructure/config";

import TickerTape from "./TickerTape";
import HeaderClocks from "./HeaderClocks";
import AuthCell from "./AuthCell";
import KpiStrip from "./KpiStrip";
import Breadth from "./Breadth";
import Watchlist from "./Watchlist";
import MarketHero from "./MarketHero";
import Movers from "./Movers";
import { Panel } from "./Panel";

import ThemeToggle from "../ThemeToggle";
import PriceCards from "../PriceCards";
import MarketHeatmap from "../MarketHeatmap";
import MarketPulse from "../MarketPulse";
import MarketOverview from "../MarketOverview";
import RealtimeChart from "../RealtimeChart";
import MultiCoinChart from "../MultiCoinChart";
import PriceCharts from "../PriceCharts";
import Extremes from "../Extremes";
import CorrelationMatrix from "../CorrelationMatrix";
import RiskReturnScatter from "../RiskReturnScatter";
import VolatilityRank from "../VolatilityRank";
import PortfolioPL from "../PortfolioPL";
import PriceAlerts from "../PriceAlerts";
import AccountPanel from "../AccountPanel";
import DataExport from "../DataExport";
import WorldClocks from "../WorldClocks";
import ObservabilityPanel from "../ObservabilityPanel";

/* =============================================================================
 * The terminal shell.
 *
 * One island owns the two pieces of state the whole screen shares — the tab and
 * the selected pair — and everything else stays a leaf. That's why the
 * watchlist can re-point the hero, the candles and the realtime chart with one
 * click: there is exactly one selection on the page, not one per panel.
 *
 * Tabs, not a long scroll: each tab is a desk you'd actually sit at, and the
 * hint on the right of the nav tells you what's on it before you switch.
 * ========================================================================== */

const TABS = [
  { key: "markets", label: "Markets", hint: "spot · map · breadth" },
  { key: "charts", label: "Charts", hint: "realtime · relative · range" },
  { key: "risk", label: "Risk", hint: "correlation · volatility · movers" },
  { key: "desk", label: "Desk", hint: "portfolio · alerts · export" },
  { key: "ops", label: "Ops", hint: "metrics · prometheus · grafana" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const ENDPOINTS = [
  { label: "▣ Grafana", href: GRAFANA_URL },
  { label: "◷ Prometheus", href: PROMETHEUS_URL },
  { label: "▲ Alertmanager", href: ALERTMANAGER_URL },
  { label: "≡ Raw metrics", href: METRICS_URL },
  { label: "♥ Health", href: HEALTH_URL },
];

export default function Terminal() {
  const [tab, setTab] = useState<TabKey>("markets");
  const [selected, setSelected] = useState("BTC");
  const [held, setHeld] = useState(false);

  const { coins } = useCoins();
  const { prices, live } = useLivePrices();
  const tickRate = useTickRate();

  const priceBySymbol = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of prices) {
      if (p.currency === "USD") m.set(p.coin, Number(p.value));
    }
    return m;
  }, [prices]);

  // Default the selection to the first tracked pair once the registry lands.
  const selectedCoin =
    coins.find((c) => c.symbol === selected) ?? coins[0];

  function toggleHold() {
    const next = !held;
    setHeld(next);
    setFeedPaused(next);
  }

  const streaming = live && !held;
  const liveColor = held ? "var(--cw-dim)" : streaming ? "var(--cw-up)" : "var(--cw-dim)";
  const liveLabel = held ? "Held" : streaming ? "Live" : "Connecting";
  const hint = TABS.find((t) => t.key === tab)?.hint ?? "";

  return (
    <div className="cw-shell">
      <TickerTape />

      <header className="cw-header">
        <div className="cw-brand">
          <span className="cw-brand__mark">
            Crypto<span style={{ color: "var(--cw-accent)" }}>·</span>Watch
          </span>
          <span className="cw-brand__kicker">Terminal</span>
          <span className="cw-live" style={{ color: liveColor }}>
            <span className={`cw-live__dot ${streaming ? "blip" : ""}`} />
            {liveLabel}
          </span>
          <span className="cw-brand__kicker" title="Price updates per second, measured over the last 2s">
            {tickRate.toFixed(1)} ticks/s
          </span>
        </div>
        <div className="flex flex-wrap">
          <HeaderClocks />
          <AuthCell />
          <ThemeToggle />
          <button
            onClick={toggleHold}
            className="cw-clock"
            style={{
              cursor: "pointer",
              textAlign: "left",
              background: held ? "var(--cw-accent)" : "transparent",
              color: held ? "var(--cw-on-accent)" : "var(--cw-fg)",
            }}
          >
            <span className="cw-clock__city" style={{ color: "inherit", opacity: 0.75 }}>
              Feed
            </span>
            <span className="cw-clock__time" style={{ display: "block", fontSize: 13 }}>
              {held ? "■ RESUME" : "● STREAMING"}
            </span>
          </button>
        </div>
      </header>

      <nav className="cw-tabs" role="tablist" aria-label="Terminal sections">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className="cw-tab"
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <span className="label self-center px-4">{hint}</span>
      </nav>

      {tab === "markets" && (
        <>
          <div className="cw-split" style={{ gridTemplateColumns: "minmax(0,1fr) 380px" }}>
            <MarketHero coin={selectedCoin} live={priceBySymbol.get(selectedCoin?.symbol ?? "")} />
            <Watchlist
              coins={coins}
              live={priceBySymbol}
              selected={selectedCoin?.symbol ?? ""}
              onSelect={setSelected}
            />
          </div>

          <KpiStrip coins={coins} />

          <div className="cw-split" style={{ gridTemplateColumns: "minmax(0,1fr) 320px" }}>
            <Panel title="Market map" right="area = mcap · fill = 24h" bodyClass="">
              <MarketHeatmap />
            </Panel>
            <Breadth coins={coins} />
          </div>

          <div style={{ borderBottom: "2px solid var(--cw-line)" }}>
            <div className="cw-head">
              <span>Spot prices</span>
              <span style={{ color: "var(--cw-dim)" }}>all tracked currencies</span>
            </div>
            <PriceCards />
          </div>
        </>
      )}

      {tab === "charts" && (
        <>
          <div style={{ borderBottom: "2px solid var(--cw-line)" }}>
            <Panel title={`Realtime · ${selectedCoin?.symbol ?? ""}/USD`} right="live stream" bodyClass="">
              <RealtimeChart />
            </Panel>
          </div>
          <div className="cw-split" style={{ gridTemplateColumns: "minmax(0,1fr) 320px" }}>
            <Panel title="Relative performance · rebased 100" bodyClass="">
              <MultiCoinChart />
            </Panel>
            <Panel title="High / low range" right="24h" bodyClass="">
              <Extremes />
            </Panel>
          </div>
          <div className="cw-split" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
            <Panel title="Price series" bodyClass="">
              <PriceCharts />
            </Panel>
            <Panel title="Market pulse" bodyClass="">
              <MarketPulse />
            </Panel>
          </div>
        </>
      )}

      {tab === "risk" && (
        <>
          <div className="cw-split" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
            <Panel title="Correlation matrix" right="pearson · returns" bodyClass="">
              <CorrelationMatrix />
            </Panel>
            <Panel title="Risk / return map" right="σ vs return" bodyClass="">
              <RiskReturnScatter />
            </Panel>
          </div>
          <div className="cw-split" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
            <Panel title="Volatility rank" right="30d σ" bodyClass="">
              <VolatilityRank />
            </Panel>
            <Movers coins={coins} live={priceBySymbol} />
          </div>
          <div>
            <Panel title="Market overview" right="dominance · breadth" bodyClass="">
              <MarketOverview />
            </Panel>
          </div>
        </>
      )}

      {tab === "desk" && (
        <>
          <div className="cw-split" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
            <Panel title="Portfolio · live P/L" bodyClass="">
              <PortfolioPL />
            </Panel>
            <Panel title="Price alerts" right={streaming ? "armed" : "feed held"} bodyClass="">
              <PriceAlerts />
            </Panel>
          </div>
          <div className="cw-split" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
            <Panel title="Account · cloud sync" bodyClass="">
              <AccountPanel />
            </Panel>
            <Panel title="Data export" bodyClass="">
              <DataExport />
            </Panel>
          </div>
          {/* The header carries four fixed venues as chrome; this is the
              configurable set — up to 8 from the catalog, persisted and synced
              with the rest of the account preferences. */}
          <div style={{ borderBottom: "2px solid var(--cw-line)" }}>
            <Panel title="Market clocks" right="pick up to 8 · saved to your account" bodyClass="">
              <WorldClocks />
            </Panel>
          </div>
          <Panel title="Endpoints" right="observability stack">
            <div className="flex flex-wrap gap-1.5">
              {ENDPOINTS.map((e) => (
                <a
                  key={e.label}
                  href={e.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cw-chip"
                  style={{ color: "var(--cw-dim)" }}
                >
                  {e.label}
                </a>
              ))}
            </div>
            <p style={{ fontSize: 11, color: "var(--cw-dim)", marginTop: 10 }}>
              All five are wired into the <strong>Ops</strong> tab — open them here only when you want the
              full native UI.
            </p>
          </Panel>
        </>
      )}

      {tab === "ops" && <ObservabilityPanel />}

      <footer className="cw-footer">
        <span>Crypto·Watch Terminal · data via CoinGecko</span>
        <span>Rust + Axum · Astro · WebSockets · Prometheus + Grafana</span>
      </footer>
    </div>
  );
}

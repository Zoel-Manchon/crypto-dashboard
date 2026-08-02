# Crypto·Watch Terminal

[![CI](https://github.com/Zoel-Manchon/crypto-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/Zoel-Manchon/crypto-dashboard/actions/workflows/ci.yml)
[![Security](https://github.com/Zoel-Manchon/crypto-dashboard/actions/workflows/security.yml/badge.svg)](https://github.com/Zoel-Manchon/crypto-dashboard/actions/workflows/security.yml)

A real-time cryptocurrency market terminal. Prices tick on every exchange trade, candles are aggregated live in the browser, and the monitoring stack is a tab inside the product rather than five links you open somewhere else — on a clean-architecture Rust backend and an Astro + React frontend.

> **🚧 Work in progress.** The core feature set is complete and functional. Tracked coins are **discovered at runtime** — the top *N* by market cap (default 25), refreshed periodically from CoinGecko.

## Demo

<!-- ─────────────────────────────────────────────────────────────────────────
     RECORD THE DEMO, THEN DO ONE OF THESE TWO THINGS. Nothing else to edit.

     A) File in the repo (what this README is set up for):
        Save the recording as  docs/screenshots/demo.mp4
        and its first frame as docs/screenshots/poster.png
        The thumbnail below then works with no changes.
        See docs/screenshots/README.md for the shot list and the ffmpeg commands.

     B) Inline player (keeps the binary out of the repo entirely):
        Drag the .mp4 into a new issue comment on this repo, copy the
        user-attachments URL GitHub gives back, and paste it alone on the
        blank line below — no markdown, no brackets. Then delete the
        thumbnail block underneath.

     GitHub cannot play a repo-relative .mp4 inline; that limitation is why
     option A uses a poster image instead of a player.
     ───────────────────────────────────────────────────────────────────── -->



[![Crypto·Watch terminal — watch the demo](docs/screenshots/poster.png)](docs/screenshots/demo.mp4)

<sub><b>▶ Click to play</b> — Markets → Charts → Risk → Ops. The tape runs, the headline price flashes on every trade, and candles build in 5-second buckets from the live stream.</sub>

---

## What it does

**A terminal, not a dashboard.** Five tabs, each one a desk you'd actually sit at:

| Tab | What's on it |
|-----|--------------|
| **Markets** | Headline pair at 104px, live candles, watchlist with sparklines, KPI strip, treemap heatmap, breadth + fear/greed |
| **Charts** | Realtime ticker, relative-performance overlay rebased to 100, high/low range, per-coin series |
| **Risk** | Pearson correlation matrix, risk/return map, volatility rank, 24h movers |
| **Desk** | Portfolio P/L, price alerts, account & cloud sync, configurable market clocks, CSV/JSON/XLSX export |
| **Ops** | Backend vitals from `/metrics`, Prometheus targets and alert rules, embedded Grafana |

**Genuinely real-time.** Two price sources are composed behind one port: the backend WebSocket (all four currencies, source of truth) and the Binance trade stream (USD, sub-second). USD prices move on every trade; the header reports the *measured* tick rate, not a pulsing dot that would blink just as happily against a dead socket.

**Candles built in the browser.** The stored OHLC series is only as dense as the poll interval, so candles are aggregated client-side from the tape into 1s / 5s / 15s / 1m buckets. The fold is a pure function with unit tests.

**Other things worth mentioning**

- **Market heatmap** — squarified treemap sized by market cap or 24h volume, coloured by 24h change (hand-rolled layout algorithm)
- **Multi-currency** — USD, EUR, JPY, RUB
- **Price alerts** that evaluate against the live stream and fire browser notifications
- **Portfolio P/L** updating per tick
- **Accounts** — Argon2id + JWT, with watchlist / alerts / holdings synced across browsers
- **Data export** — CSV, JSON, and a 5-sheet XLSX workbook
- **Market clocks** — pick up to 8 venues from a 14-city catalog, synced with your account
- **Two palettes** — `midnight` and `solar`, persisted across sessions

---

## Tech Stack

**Backend**
- [Rust](https://www.rust-lang.org/) with [Axum](https://github.com/tokio-rs/axum)
- [SQLx](https://github.com/launchbadge/sqlx) with PostgreSQL, over **TLS 1.3** (rustls)
- [Tokio](https://tokio.rs/) async runtime
- Price data from the [CoinGecko API](https://www.coingecko.com/en/api)
- Clean / hexagonal architecture (domain · application · infrastructure · presentation)

**Frontend**
- [Astro](https://astro.build/) with React islands
- [Tailwind CSS v4](https://tailwindcss.com/), CSS-first theming
- [Recharts](https://recharts.org/) where a chart library earns its weight; hand-rolled SVG and CSS bars everywhere else
- TypeScript, mirroring the backend's layering, with Vitest on the pure domain

---

## Architecture

Both the backend (Rust) and the frontend (TypeScript) follow a **hexagonal / ports-and-adapters** layout: domain and use-cases never depend on Axum, `reqwest`, `sqlx`, or `fetch` — those live in infrastructure adapters behind ports. The dependency rule points inward.

The realtime feed is where the seam pays off. Three adapters implement one `PriceStream` port:

| Adapter | Source | Cadence | Currencies |
|---------|--------|---------|------------|
| `WebSocketPriceStream` | this backend | one batch per poll cycle | USD · EUR · JPY · RUB |
| `BinancePriceStream` | Binance public trades | every trade, flushed per animation frame | USD (USDT proxy) |
| `CompositePriceStream` | fan-in over both | continuous | all four |

The app runs on the composite; the realtime chart lets you watch either underlying stream on its own, which makes the difference between them visible rather than theoretical.

```mermaid
flowchart LR
  subgraph Browser
    UI["Astro + React UI<br/>domain · application · infrastructure"]
    BIN["Binance trades"]
  end
  subgraph Backend["Rust + Axum backend (hexagonal)"]
    direction TB
    PRES["Presentation<br/>HTTP · WebSocket · /metrics"]
    APP["Application<br/>use-cases · ports"]
    DOM["Domain<br/>Coin · Price · Currency · Period"]
    INFRA["Infrastructure<br/>CoinGecko · Postgres · registry · scheduler · metrics"]
    PRES --> APP --> DOM
    APP --> INFRA --> DOM
  end
  CG["CoinGecko API"]
  DB[("PostgreSQL")]
  UI <-->|REST + WebSocket| PRES
  BIN -->|sub-second trades| UI
  INFRA -->|poll / discover| CG
  INFRA -->|read / write| DB
  subgraph Observability
    PROM["Prometheus"] --> AM["Alertmanager"]
    PROM --> GRAF["Grafana"]
  end
  PRES -->|/metrics| PROM
  PROM -->|query| UI
  GRAF -->|embed| UI
```

### How a price tick flows

```mermaid
sequenceDiagram
  participant S as Scheduler
  participant P as CoinGecko provider
  participant R as Postgres repo
  participant B as Broadcast channel
  participant W as WebSocket
  participant UI as Browser
  loop every POLL_INTERVAL_SECONDS
    S->>P: fetch_current_prices(tracked ids)
    P-->>S: prices (USD/EUR/JPY/RUB)
    S->>R: save_prices(batch)
    S->>B: send(batch)
    B->>W: batch
    W-->>UI: live prices (JSON)
  end
  Note over UI: cards flash · alerts evaluate · candles fold
```

A separate task periodically calls CoinGecko `/coins/markets` to re-rank the **top-N coins by market cap** and refresh an in-memory registry; the poll loop always uses whatever the registry currently holds. On first boot the DB is seeded with ~7 days of history reconstructed from each coin's sparkline (zero extra API calls).

### Deployment (docker compose)

```mermaid
flowchart TB
  subgraph compose["docker compose"]
    FE["frontend :4321"]
    BE["backend :8080"]
    PG[("postgres :5433")]
    PR["prometheus :9090"]
    AM["alertmanager :9093"]
    GR["grafana :3000"]
  end
  FE --> BE
  BE --> PG
  PR -->|scrape /metrics| BE
  PR --> AM
  GR -->|query| PR
```

### Project structure

```
src/                  Rust backend (hexagonal)
  domain/             entities, errors (pure) + unit tests
  application/        use-cases + ports (traits)
  infrastructure/     coingecko, postgres, registry, scheduler, metrics, rate_limit
  presentation/       axum router, handlers, DTOs, websocket
migrations/           SQL migrations (run on startup)
frontend/src/         Astro + React, mirrors the same layering (+ Vitest)
  domain/             pure logic: candle folding, correlation, treemap
  infrastructure/     http gateway, websocket adapters, auth, container
  presentation/       components (terminal/ = the shell), hooks, layouts
observability/        prometheus, alertmanager, grafana provisioning
.github/workflows/    CI (Rust + frontend) · Security (cargo audit, npm audit, Trivy)
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Liveness check |
| `GET` | `/api/coins` | Tracked coins + market cap, volume, 24h change, supply, 7d sparkline |
| `GET` | `/metrics` | Prometheus metrics (poll/discovery/write counts, durations, uptime) |
| `GET` | `/api/prices/ohlc` | OHLC candles (`coin`, `currency`, `period`) bucketed from stored ticks |
| `GET` | `/api/prices/latest` | Latest price for every coin/currency |
| `GET` | `/api/prices/extremes?coin=&currency=&period=` | Highest & lowest over a period |
| `GET` | `/api/prices/series?coin=&currency=&period=` | Time-series for charts |
| `GET` | `/api/prices/export?coin=&currency=&period=` | Download price series as CSV |
| `WS`  | `/api/ws` | Real-time price broadcast |
| `POST` | `/api/auth/register` | Create an account (Argon2 hash) → JWT session |
| `POST` | `/api/auth/login` | Verify credentials → JWT session |
| `GET` | `/api/prefs` | 🔒 Synced preferences blob for the bearer |
| `PUT` | `/api/prefs` | 🔒 Replace the bearer's synced preferences |

`coin` ∈ the live top-N registry (`/api/coins`) · `currency` ∈ `USD, EUR, JPY, RUB` · `period` ∈ `day, week, month` · 🔒 = requires `Authorization: Bearer <token>`

---

## Getting Started

### Run with Docker (recommended)

Everything — backend, frontend, PostgreSQL, and the full observability stack — starts with a single command:

```bash
docker compose up --build
```

Then open:

| Service | URL |
|---------|-----|
| Terminal (frontend) | http://localhost:4321 |
| Backend API | http://localhost:8080 |
| Grafana | http://localhost:3000 |
| Prometheus | http://localhost:9090 |
| Alertmanager | http://localhost:9093 |
| PostgreSQL | localhost:5433 |

On startup the backend runs its migrations, discovers the top coins by market cap, seeds ~7 days of history from sparklines, and begins polling CoinGecko. No `.env` is required — Compose sets working defaults. Stop with `docker compose down` (add `-v` to also drop the database volume).

The first landing is a sign-in gate: create an account to sync your watchlist, alerts and holdings, or continue as a guest. Market data is public — the gate is UX, and only `/api/prefs` is actually protected.

> **Note on the tape.** USD prices tick sub-second by streaming public trades from Binance directly in the browser. If your network blocks that, the terminal falls back to the backend's poll cadence and the tick counter in the header will read `0.0` — everything still works, just once per `POLL_INTERVAL_SECONDS`.

---

### Run locally (without Docker)

#### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (stable)
- [Node.js](https://nodejs.org/) 20+ (CI uses 22)
- [PostgreSQL](https://www.postgresql.org/) 14+

#### 1. Database

```sql
CREATE DATABASE crypto_dashboard;
```

#### 2. Backend

Create a `.env` file in the project root:

```env
DATABASE_URL=postgres://postgres:yourpassword@localhost:5432/crypto_dashboard
DB_MAX_CONNECTIONS=5
DB_SSL_MODE=prefer
POLL_INTERVAL_SECONDS=60
CORS_ALLOWED_ORIGIN=http://localhost:4321
```

Then start the server (migrations run automatically on startup):

```bash
cargo run
```

The backend listens on `0.0.0.0:8080`, begins polling CoinGecko, and serves the API. Use `DB_SSL_MODE=require` (plus `DB_CA_CERT_PATH` for `verify-full`) when your PostgreSQL enforces TLS.

#### 3. Frontend

```bash
cd frontend
npm ci
npm run dev
```

The terminal is available at `http://localhost:4321`.

```bash
npm test          # Vitest — pure domain: candle folding, correlation, treemap
npm run build     # astro check + production build
```

> Run the backend and frontend together. `CORS_ALLOWED_ORIGIN` scopes the API to the frontend's origin.

---

## Configuration

### Backend

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | — (required) |
| `DB_MAX_CONNECTIONS` | Connection pool size | `5` |
| `DB_SSL_MODE` | `require` or `verify-full` | `require` |
| `DB_CA_CERT_PATH` | CA cert path (required for `verify-full`) | — |
| `POLL_INTERVAL_SECONDS` | How often to poll CoinGecko | `300` |
| `TRACKED_COINS_LIMIT` | How many coins to track (top-N by market cap) | `25` |
| `COIN_REFRESH_SECONDS` | How often to re-rank the tracked coin set | `3600` |
| `CORS_ALLOWED_ORIGIN` | Exact allowed CORS origin (empty = any, dev) | _(empty)_ |
| `RATE_LIMIT_PER_MIN` | Max requests per IP per minute (0 = off) | `120` |
| `JWT_SECRET` | Secret for signing session JWTs — **change in production** | `dev-secret-change-me` |
| `TOKEN_TTL_HOURS` | Session token lifetime | `24` |

### Frontend

Inlined at build time and visible in the browser — nothing secret goes here.

| Variable | Description | Default |
|----------|-------------|---------|
| `PUBLIC_API_BASE_URL` | Backend origin | `http://127.0.0.1:8080` |
| `PUBLIC_WS_URL` | Backend price WebSocket | `ws://127.0.0.1:8080/api/ws` |
| `PUBLIC_BINANCE_WS_URL` | Binance combined-stream endpoint | `wss://stream.binance.com:9443` |
| `PUBLIC_GRAFANA_URL` | Grafana origin (embedded in the Ops tab) | `http://localhost:3000` |
| `PUBLIC_PROMETHEUS_URL` | Prometheus origin (queried from the Ops tab) | `http://localhost:9090` |
| `PUBLIC_ALERTMANAGER_URL` | Alertmanager origin | `http://localhost:9093` |
| `PUBLIC_GRAFANA_DASHBOARD_UID` | UID of the provisioned dashboard | `crypto-watch` |

**TLS:** The backend connects to PostgreSQL over TLS. `require` encrypts the connection; `verify-full` additionally verifies the server certificate against a CA (set `DB_CA_CERT_PATH`). Switching modes is a `.env` change — no code edits.

---

## Observability

`docker compose up --build` starts Prometheus, Alertmanager and Grafana alongside the app. The backend exposes Prometheus metrics at `/metrics`; Prometheus scrapes them, Grafana renders a pre-provisioned dashboard, and Alertmanager routes what fires.

All of it surfaces in the terminal's **Ops** tab, in three layers that fail independently — because "the chart is empty" and "Prometheus is unreachable" are different problems:

1. **Service vitals**, parsed from the backend's own `/metrics` text endpoint. Works even with the monitoring stack down — it's the service reporting on itself.
2. **Prometheus** over its HTTP API: `rate()` queries, scrape-target health, and pending/firing alert rules.
3. **Grafana**, embedded in kiosk mode as the anonymous Viewer the compose file provisions.

Direct access if you want the native UIs:

- Grafana: http://localhost:3000 (anonymous viewing enabled; `admin`/`admin` to edit) — dashboard **Crypto·Watch — Backend**
- Prometheus: http://localhost:9090 (alert rules under **Alerts**)
- Alertmanager: http://localhost:9093 — routes warning/critical alerts to a Slack/Discord receiver (`observability/alertmanager.yml`; paste your incoming-webhook URL to enable real notifications)

Alert rules (`observability/alerts.yml`) cover backend down, no successful polls, poll/discovery errors, and an empty registry. Metrics include poll cycles by result, price rows written, coin-discovery refreshes, tracked-coin count, last poll duration, and HTTP request totals.

> Embedding requires `GF_SECURITY_ALLOW_EMBEDDING=true`, which the compose file sets. Without it Grafana sends `X-Frame-Options: deny` and the panel renders blank.

---

## Security

Supply-chain and code scanning run on every push and weekly: `cargo audit` (RustSec), `npm audit`, and Trivy (vulnerabilities, secrets, misconfigurations), plus Dependabot across cargo, npm, and GitHub Actions. Runtime hardening includes scoped CORS, security headers, per-IP rate limiting, Argon2id password hashing, and configurable PostgreSQL TLS up to `verify-full`.

Details and reporting: [SECURITY.md](SECURITY.md) · production setup: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Roadmap

- [x] **More cryptocurrencies** — dynamic top-N by market cap (default 25)
- [x] 24h volume and market-cap indicators — market heatmap + per-coin stats
- [x] Configurable coin count (`TRACKED_COINS_LIMIT`) + in-UI search/sort/overlay selection
- [x] Excel (`.xlsx`) export — 5-sheet workbook via `write-excel-file`
- [x] `verify-full` TLS in production — see the [deployment guide](docs/DEPLOYMENT.md)
- [x] [Deployment guide](docs/DEPLOYMENT.md) — VPS, Caddy TLS, hardening checklist
- [x] Sub-second price streaming with client-side candle aggregation
- [x] Observability surfaced inside the product (Ops tab)
- [x] Configurable market clocks — up to 8 from a 14-city catalog, in the Desk tab (the header carries four fixed venues as chrome)
- [ ] Exchange WebSocket ingestion in the Rust backend, so real-time doesn't depend on the browser reaching Binance

## License

This project is provided as-is for educational and personal use.

---

## Acknowledgements

Price data from [CoinGecko](https://www.coingecko.com/) and [Binance](https://www.binance.com/) public streams. Built with Rust, Axum, Astro and React.

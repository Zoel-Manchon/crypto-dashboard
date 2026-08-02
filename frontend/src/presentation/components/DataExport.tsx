import { useEffect, useState } from "react";
import type { Sheet as XlsxSheet, Cell as XlsxCell } from "write-excel-file/browser";
import { api } from "../../infrastructure/container";
import { useCoins } from "../hooks/useCoins";
import {
  ALL_CURRENCIES,
  ALL_PERIODS,
  type Currency,
  type Period,
} from "../../domain/price";

export default function DataExport() {
  const { coins, symbols } = useCoins();
  const [coin, setCoin] = useState<string>("");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [period, setPeriod] = useState<Period>("month");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!coin && coins.length > 0) setCoin(coins[0].symbol);
  }, [coins, coin]);

  // CSV: the backend already serves a downloadable file — just navigate to it.
  function downloadCsv() {
    if (!coin) return;
    window.open(api.exportUrl(coin, currency, period), "_blank");
  }

  // JSON: reuse the series use case, serialize client-side, trigger a download.
  async function downloadJson() {
    if (!coin) return;
    setBusy(true);
    try {
      const points = await api.series(coin, currency, period);
      const payload = {
        coin,
        currency,
        period,
        exportedAt: new Date().toISOString(),
        points: points.map((p) => ({ value: p.value, observedAt: p.observedAt.toISOString() })),
      };
      triggerDownload(JSON.stringify(payload, null, 2), `${coin}_${currency}_${period}_prices.json`);
    } finally {
      setBusy(false);
    }
  }

  async function downloadAllJson() {
    if (symbols.length === 0) return;
    setBusy(true);
    try {
      const rows = await Promise.all(
        symbols.flatMap((c) =>
          ALL_CURRENCIES.map(async (cur) => ({
            coin: c,
            currency: cur,
            points: await api.series(c, cur, period),
          })),
        ),
      );

      const payload = {
        period,
        exportedAt: new Date().toISOString(),
        datasets: rows.map((row) => ({
          coin: row.coin,
          currency: row.currency,
          points: row.points.map((p) => ({ value: p.value, observedAt: p.observedAt.toISOString() })),
        })),
      };
      triggerDownload(JSON.stringify(payload, null, 2), `ALL_COINS_ALL_FIAT_${period}_prices.json`);
    } finally {
      setBusy(false);
    }
  }

  // XLSX: build a multi-sheet workbook client-side with write-excel-file
  // (lazy-loaded so it never weighs down the initial page).
  async function downloadXlsx() {
    if (!coin) return;
    setBusy(true);
    try {
      const { default: writeXlsxFile } = await import("write-excel-file/browser");

      type Cell = XlsxCell;
      type Sheet = XlsxSheet<File | Blob | ArrayBuffer>;

      const header = (names: string[]): Cell[] => names.map((n) => ({ value: n, fontWeight: "bold" as const }));
      const cell = (v: unknown): Cell =>
        typeof v === "number" ? { value: v, type: Number } : { value: String(v ?? ""), type: String };
      const fromObjects = (name: string, rows: Record<string, unknown>[]): Sheet => {
        const keys = Object.keys(rows[0]);
        return { sheet: name, data: [header(keys), ...rows.map((r) => keys.map((k) => cell(r[k])))] };
      };

      const sheets: Sheet[] = [];

      // Sheet 1 — the selected price series.
      const points = await api.series(coin, currency, period);
      sheets.push(
        fromObjects(
          "Prices",
          points.map((p) => ({ "Observed At (UTC)": p.observedAt.toISOString(), Price: Number(p.value) })),
        ),
      );

      // Sheet 2 — current market summary across all tracked coins.
      sheets.push(
        fromObjects(
          "Market Summary",
          coins.map((c) => ({
            Symbol: c.symbol,
            Name: c.name,
            Rank: c.rank ?? 0,
            "Market Cap (USD)": c.marketCap ?? 0,
            "Volume 24h (USD)": c.volume24h ?? 0,
            "Change 24h (%)": c.change24h ?? 0,
            "Circulating Supply": c.circulatingSupply ?? 0,
          })),
        ),
      );

      // Sheet 3 — OHLC candles for the same selection (best-effort).
      try {
        const candles = await api.ohlc(coin, currency, period);
        if (candles.length > 0) {
          sheets.push(
            fromObjects(
              "OHLC",
              candles.map((c) => ({ "Bucket (UTC)": c.t.toISOString(), Open: c.o, High: c.h, Low: c.l, Close: c.c })),
            ),
          );
        }
      } catch {
        /* candles are optional in the workbook */
      }

      // Sheets 4-5 — the user's local holdings & alerts, if any (shape-agnostic).
      for (const [key, name] of [["cw.holdings", "Holdings"], ["cw.alerts", "Alerts"]] as const) {
        try {
          const parsed = JSON.parse(localStorage.getItem(key) ?? "[]") as Record<string, unknown>[];
          if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object") {
            sheets.push(fromObjects(name, parsed));
          }
        } catch {
          /* skip malformed local data */
        }
      }

      await writeXlsxFile(sheets).toFile(`cryptowatch_${coin}_${currency}_${period}.xlsx`);
    } finally {
      setBusy(false);
    }
  }

  function triggerDownload(text: string, filename: string) {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const selectStyle = {
    backgroundColor: "var(--bg-row)",
    color: "var(--text)",
    border: "1px solid var(--grid)",
  };

  return (
    <div className="border" style={{ borderColor: "var(--grid-strong)", backgroundColor: "var(--bg-panel)" }}>
      <div className="flex flex-wrap items-end gap-4 px-4 py-4">
        <div className="flex flex-col gap-1">
          <span className="label">COIN</span>
          <select
            value={coin}
            onChange={(e) => setCoin(e.target.value)}
            className="px-3 py-1.5 text-sm font-bold"
            style={selectStyle}
          >
            {coins.map((c) => (
              <option key={c.symbol} value={c.symbol}>{c.symbol}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="label">CURRENCY</span>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
            className="px-3 py-1.5 text-sm font-bold"
            style={selectStyle}
          >
            {ALL_CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="label">PERIOD</span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="px-3 py-1.5 text-sm font-bold uppercase"
            style={selectStyle}
          >
            {ALL_PERIODS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={downloadCsv}
            className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors"
            style={{ backgroundColor: "var(--color-accent)", color: "#050506" }}
          >
            ↓ CSV
          </button>
          <button
            onClick={downloadXlsx}
            disabled={busy}
            className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors"
            style={{ backgroundColor: "#1d6f42", color: "#eafff2", opacity: busy ? 0.5 : 1 }}
            title="Two sheets: price series + live market summary"
          >
            {busy ? "…" : "↓ XLSX"}
          </button>
          <button
            onClick={downloadJson}
            disabled={busy}
            className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors"
            style={{ backgroundColor: "var(--bg-row)", color: "var(--text)", border: "1px solid var(--grid-strong)", opacity: busy ? 0.5 : 1 }}
          >
            {busy ? "…" : "↓ JSON"}
          </button>
          <button
            onClick={downloadAllJson}
            disabled={busy}
            className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors"
            style={{ backgroundColor: "var(--bg-row)", color: "var(--text)", border: "1px solid var(--grid-strong)", opacity: busy ? 0.5 : 1 }}
          >
            {busy ? "…" : "↓ ALL JSON"}
          </button>
        </div>
      </div>

      <p className="border-t px-4 py-2 label" style={{ borderColor: "var(--grid)" }}>
        EXPORTS {coin || "—"} / {currency} / {period.toUpperCase()} PRICE SERIES · XLSX ADDS A MARKET-SUMMARY SHEET · ALL JSON SPANS {symbols.length} COINS × USD EUR JPY RUB
      </p>
    </div>
  );
}

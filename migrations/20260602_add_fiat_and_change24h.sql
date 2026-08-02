-- Run once against your existing Postgres database.
-- JPY/RUB reuse the existing prices table: each fiat quote is just another row.

ALTER TABLE prices
  ADD COLUMN IF NOT EXISTS change_24h DOUBLE PRECISION;

-- Helpful for latest/series queries across more coins/currencies.
CREATE INDEX IF NOT EXISTS idx_prices_coin_currency_observed_at
  ON prices (coin, currency, observed_at DESC);

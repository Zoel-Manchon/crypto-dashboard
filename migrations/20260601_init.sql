-- Base schema. Creates the prices table the rest of the app depends on.
-- Each row is one coin/currency quote at one instant; fiats are just more rows.
CREATE TABLE IF NOT EXISTS prices (
    id          BIGSERIAL PRIMARY KEY,
    coin        TEXT NOT NULL,            -- CoinGecko id, e.g. "bitcoin"
    currency    TEXT NOT NULL,            -- "usd" | "eur" | "jpy" | "rub"
    value       NUMERIC NOT NULL,         -- exact price (rust_decimal <-> NUMERIC)
    observed_at TIMESTAMPTZ NOT NULL,
    change_24h  DOUBLE PRECISION          -- provider 24h % change, nullable
);

CREATE INDEX IF NOT EXISTS idx_prices_coin_currency_observed_at
    ON prices (coin, currency, observed_at DESC);

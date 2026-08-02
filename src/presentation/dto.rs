use serde::Serialize;

use crate::domain::entities::{Candle, CoinMeta, Price, PriceExtremes, PricePoint};

/// JSON shape for a single latest price (one card).
#[derive(Debug, Serialize)]
pub struct PriceDto {
    pub coin: String,
    pub currency: String,
    pub value: String,       // Decimal as string — preserves exact precision in JSON
    pub observed_at: String, // RFC3339 timestamp
    pub change_24h: Option<f64>,
}

impl From<&Price> for PriceDto {
    fn from(p: &Price) -> Self {
        Self {
            coin: p.coin.symbol().to_string(),
            currency: p.currency.code().to_uppercase(),
            value: p.value.to_string(),
            observed_at: p.observed_at.to_rfc3339(),
            change_24h: p.change_24h,
        }
    }
}

/// JSON shape for highest/lowest over a period.
#[derive(Debug, Serialize)]
pub struct ExtremesDto {
    pub coin: String,
    pub currency: String,
    pub period: String,
    pub highest: String,
    pub lowest: String,
}

impl From<&PriceExtremes> for ExtremesDto {
    fn from(e: &PriceExtremes) -> Self {
        Self {
            coin: e.coin.symbol().to_string(),
            currency: e.currency.code().to_uppercase(),
            period: format!("{:?}", e.period).to_lowercase(),
            highest: e.highest.to_string(),
            lowest: e.lowest.to_string(),
        }
    }
}

/// One point in a chart series.
#[derive(Debug, Serialize)]
pub struct PricePointDto {
    pub value: String,
    pub observed_at: String,
}

impl From<&PricePoint> for PricePointDto {
    fn from(p: &PricePoint) -> Self {
        Self {
            value: p.value.to_string(),
            observed_at: p.observed_at.to_rfc3339(),
        }
    }
}

/// JSON shape describing a tracked coin — served by `GET /api/coins` so the
/// frontend never has to hardcode the coin list, names, or colors.
#[derive(Debug, Serialize)]
pub struct CoinMetaDto {
    pub symbol: String,
    pub name: String,
    pub id: String,
    pub image: Option<String>,
    pub rank: Option<u32>,
    pub market_cap: Option<f64>,
    pub volume_24h: Option<f64>,
    pub change_24h: Option<f64>,
    pub circulating_supply: Option<f64>,
    pub sparkline_7d: Option<Vec<f64>>,
}

impl From<&CoinMeta> for CoinMetaDto {
    fn from(m: &CoinMeta) -> Self {
        Self {
            symbol: m.coin.symbol().to_string(),
            name: m.coin.name().to_string(),
            id: m.coin.coingecko_id().to_string(),
            image: m.image.clone(),
            rank: m.rank,
            market_cap: m.market_cap,
            volume_24h: m.volume_24h,
            change_24h: m.change_24h,
            circulating_supply: m.circulating_supply,
            sparkline_7d: m.sparkline_7d.clone(),
        }
    }
}

/// One OHLC candle for the candlestick chart.
#[derive(Debug, Serialize)]
pub struct CandleDto {
    pub t: String,
    pub o: String,
    pub h: String,
    pub l: String,
    pub c: String,
}

impl From<&Candle> for CandleDto {
    fn from(c: &Candle) -> Self {
        Self {
            t: c.bucket.to_rfc3339(),
            o: c.open.to_string(),
            h: c.high.to_string(),
            l: c.low.to_string(),
            c: c.close.to_string(),
        }
    }
}

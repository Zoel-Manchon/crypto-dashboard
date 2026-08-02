use std::net::SocketAddr;
use std::sync::Arc;

use axum::extract::{ConnectInfo, Request, State};
use axum::http::{HeaderValue, StatusCode, header};
use axum::middleware::{self, Next};
use axum::response::Response;
use axum::{Router, routing::{get, post}};
use tower_http::cors::{AllowOrigin, Any, CorsLayer};

use crate::infrastructure::metrics::AppMetrics;
use crate::infrastructure::rate_limit::RateLimiter;
use crate::presentation::auth;
use crate::presentation::handlers::{self, AppState};
use crate::presentation::websocket::ws_handler;

/// Count every HTTP request handled, for the /metrics endpoint.
async fn count_requests(State(metrics): State<Arc<AppMetrics>>, req: Request, next: Next) -> Response {
    metrics.incr_http();
    next.run(req).await
}

/// Reject requests from an IP that exceeds the configured per-minute budget.
async fn rate_limit(
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(limiter): State<Arc<RateLimiter>>,
    req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    if limiter.check(addr.ip()) {
        Ok(next.run(req).await)
    } else {
        Err(StatusCode::TOO_MANY_REQUESTS)
    }
}

/// Add a baseline set of security headers to every response.
async fn security_headers(req: Request, next: Next) -> Response {
    let mut res = next.run(req).await;
    let h = res.headers_mut();
    h.insert(header::X_CONTENT_TYPE_OPTIONS, HeaderValue::from_static("nosniff"));
    h.insert(header::X_FRAME_OPTIONS, HeaderValue::from_static("DENY"));
    h.insert(header::REFERRER_POLICY, HeaderValue::from_static("no-referrer"));
    res
}

/// Build the application router with all routes, middleware, and shared state.
///
/// `cors_origin` scopes CORS to an exact origin when set; otherwise any origin
/// is allowed (development default).
pub fn build_router(state: AppState, cors_origin: Option<String>) -> Router {
    let cors = CorsLayer::new().allow_methods(Any).allow_headers(Any);
    let cors = match cors_origin.and_then(|o| o.parse::<HeaderValue>().ok()) {
        Some(hv) => cors.allow_origin(AllowOrigin::exact(hv)),
        None => cors.allow_origin(Any),
    };

    let metrics = state.metrics.clone();
    let limiter = state.rate_limiter.clone();

    Router::new()
        .route("/api/health", get(handlers::health))
        .route("/metrics", get(handlers::metrics))
        .route("/api/auth/register", post(auth::register))
        .route("/api/auth/login", post(auth::login))
        .route("/api/prefs", get(auth::get_prefs).put(auth::put_prefs))
        .route("/api/coins", get(handlers::coins))
        .route("/api/prices/latest", get(handlers::latest_prices))
        .route("/api/prices/extremes", get(handlers::extremes))
        .route("/api/prices/series", get(handlers::series))
        .route("/api/prices/ohlc", get(handlers::ohlc))
        .route("/api/prices/export", get(handlers::export_csv))
        .route("/api/ws", get(ws_handler))
        .layer(middleware::from_fn(security_headers))
        .layer(middleware::from_fn_with_state(limiter, rate_limit))
        .layer(middleware::from_fn_with_state(metrics, count_requests))
        .layer(cors)
        .with_state(state)
}

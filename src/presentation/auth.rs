use axum::extract::{FromRequestParts, State};
use axum::http::{StatusCode, header, request::Parts};
use axum::{Json, response::IntoResponse};
use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation, decode, encode};
use serde::{Deserialize, Serialize};

use argon2::password_hash::{PasswordHash, SaltString, rand_core::OsRng};
use argon2::{Argon2, PasswordHasher, PasswordVerifier};

use crate::application::ports::RepositoryError;
use crate::presentation::handlers::AppState;

const MAX_PREFS_BYTES: usize = 64 * 1024;

/// Signing/verification material + token lifetime, shared via AppState.
pub struct JwtKeys {
    enc: EncodingKey,
    dec: DecodingKey,
    ttl_hours: u64,
}

impl JwtKeys {
    pub fn new(secret: &str, ttl_hours: u64) -> Self {
        Self {
            enc: EncodingKey::from_secret(secret.as_bytes()),
            dec: DecodingKey::from_secret(secret.as_bytes()),
            ttl_hours,
        }
    }

    fn issue(&self, user_id: i64, username: &str, role: &str) -> Result<String, StatusCode> {
        let exp = chrono::Utc::now() + chrono::Duration::hours(self.ttl_hours as i64);
        let claims = Claims {
            sub: user_id,
            username: username.to_string(),
            role: role.to_string(),
            exp: exp.timestamp() as usize,
        };
        encode(&Header::default(), &claims, &self.enc).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
    }

    fn verify(&self, token: &str) -> Result<Claims, ()> {
        decode::<Claims>(token, &self.dec, &Validation::default())
            .map(|d| d.claims)
            .map_err(|_| ())
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: i64,
    pub username: String,
    pub role: String,
    pub exp: usize,
}

/// Extractor: a valid `Authorization: Bearer <jwt>` header, or 401.
pub struct AuthUser {
    pub user_id: i64,
    #[allow(dead_code)]
    pub username: String,
    #[allow(dead_code)]
    pub role: String,
}

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = StatusCode;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let header_val = parts
            .headers
            .get(header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .ok_or(StatusCode::UNAUTHORIZED)?;
        let token = header_val
            .strip_prefix("Bearer ")
            .ok_or(StatusCode::UNAUTHORIZED)?;
        let claims = state.jwt.verify(token).map_err(|_| StatusCode::UNAUTHORIZED)?;
        Ok(AuthUser {
            user_id: claims.sub,
            username: claims.username,
            role: claims.role,
        })
    }
}

#[derive(Debug, Deserialize)]
pub struct Credentials {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct SessionDto {
    pub token: String,
    pub username: String,
    pub role: String,
}

fn valid_username(u: &str) -> bool {
    (3..=32).contains(&u.len()) && u.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
}

/// POST /api/auth/register — create an account and return a session token.
pub async fn register(
    State(state): State<AppState>,
    Json(body): Json<Credentials>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let username = body.username.trim().to_lowercase();
    if !valid_username(&username) {
        return Err((
            StatusCode::BAD_REQUEST,
            "username must be 3-32 chars: letters, digits, underscore".into(),
        ));
    }
    if body.password.len() < 8 {
        return Err((StatusCode::BAD_REQUEST, "password must be at least 8 characters".into()));
    }

    // Argon2 is deliberately CPU-heavy — keep it off the async workers.
    let password = body.password.clone();
    let hash = tokio::task::spawn_blocking(move || {
        let salt = SaltString::generate(&mut OsRng);
        Argon2::default()
            .hash_password(password.as_bytes(), &salt)
            .map(|h| h.to_string())
    })
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "hashing failed".into()))?
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "hashing failed".into()))?;

    let id = match state.users.create_user(&username, &hash).await {
        Ok(id) => id,
        Err(RepositoryError::Conflict(_)) => {
            return Err((StatusCode::CONFLICT, "username already taken".into()));
        }
        Err(e) => return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    };

    let token = state
        .jwt
        .issue(id, &username, "user")
        .map_err(|c| (c, "token error".into()))?;
    tracing::info!(user = %username, "account registered");
    Ok(Json(SessionDto { token, username, role: "user".into() }))
}

/// POST /api/auth/login — verify credentials and return a session token.
pub async fn login(
    State(state): State<AppState>,
    Json(body): Json<Credentials>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let username = body.username.trim().to_lowercase();
    // Uniform error for unknown user / wrong password — no account probing.
    let unauthorized = || (StatusCode::UNAUTHORIZED, "invalid credentials".to_string());

    let user = state
        .users
        .find_by_username(&username)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(unauthorized)?;

    let password = body.password.clone();
    let stored = user.password_hash.clone();
    let ok = tokio::task::spawn_blocking(move || {
        PasswordHash::new(&stored)
            .map(|parsed| Argon2::default().verify_password(password.as_bytes(), &parsed).is_ok())
            .unwrap_or(false)
    })
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "verify failed".into()))?;

    if !ok {
        return Err(unauthorized());
    }
    let token = state
        .jwt
        .issue(user.id, &user.username, &user.role)
        .map_err(|c| (c, "token error".into()))?;
    tracing::info!(user = %user.username, "login ok");
    Ok(Json(SessionDto { token, username: user.username, role: user.role }))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PrefsDto {
    /// Opaque JSON string owned by the client.
    pub prefs: String,
}

/// GET /api/prefs — the caller's synced preferences blob.
pub async fn get_prefs(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let prefs = state
        .users
        .get_prefs(user.user_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .unwrap_or_else(|| "{}".to_string());
    Ok(Json(PrefsDto { prefs }))
}

/// PUT /api/prefs — replace the caller's synced preferences blob.
pub async fn put_prefs(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<PrefsDto>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    if body.prefs.len() > MAX_PREFS_BYTES {
        return Err((StatusCode::PAYLOAD_TOO_LARGE, "prefs blob too large".into()));
    }
    // Must at least be valid JSON — we store it opaquely but never garbage.
    if serde_json::from_str::<serde_json::Value>(&body.prefs).is_err() {
        return Err((StatusCode::BAD_REQUEST, "prefs must be valid JSON".into()));
    }
    state
        .users
        .put_prefs(user.user_id, &body.prefs)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(StatusCode::NO_CONTENT)
}

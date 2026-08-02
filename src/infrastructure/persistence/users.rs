use async_trait::async_trait;
use sqlx::Row;
use sqlx::postgres::PgPool;

use crate::application::ports::{RepositoryError, UserRepository};
use crate::domain::entities::User;

/// Postgres adapter for the UserRepository port.
pub struct PgUserRepository {
    pool: PgPool,
}

impl PgUserRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

fn db_err(e: sqlx::Error) -> RepositoryError {
    RepositoryError::Database(e.to_string())
}

#[async_trait]
impl UserRepository for PgUserRepository {
    async fn create_user(
        &self,
        username: &str,
        password_hash: &str,
    ) -> Result<i64, RepositoryError> {
        let res = sqlx::query("INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id")
            .bind(username)
            .bind(password_hash)
            .fetch_one(&self.pool)
            .await;
        match res {
            Ok(row) => row.try_get::<i64, _>("id").map_err(db_err),
            Err(sqlx::Error::Database(db)) if db.is_unique_violation() => {
                Err(RepositoryError::Conflict("username already taken".into()))
            }
            Err(e) => Err(db_err(e)),
        }
    }

    async fn find_by_username(&self, username: &str) -> Result<Option<User>, RepositoryError> {
        let row = sqlx::query(
            "SELECT id, username, password_hash, role FROM users WHERE username = $1",
        )
        .bind(username)
        .fetch_optional(&self.pool)
        .await
        .map_err(db_err)?;

        match row {
            None => Ok(None),
            Some(r) => Ok(Some(User {
                id: r.try_get("id").map_err(db_err)?,
                username: r.try_get("username").map_err(db_err)?,
                password_hash: r.try_get("password_hash").map_err(db_err)?,
                role: r.try_get("role").map_err(db_err)?,
            })),
        }
    }

    async fn get_prefs(&self, user_id: i64) -> Result<Option<String>, RepositoryError> {
        let row = sqlx::query("SELECT prefs FROM user_prefs WHERE user_id = $1")
            .bind(user_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(db_err)?;
        match row {
            None => Ok(None),
            Some(r) => Ok(Some(r.try_get("prefs").map_err(db_err)?)),
        }
    }

    async fn put_prefs(&self, user_id: i64, prefs: &str) -> Result<(), RepositoryError> {
        sqlx::query(
            "INSERT INTO user_prefs (user_id, prefs, updated_at) VALUES ($1, $2, now())
             ON CONFLICT (user_id) DO UPDATE SET prefs = EXCLUDED.prefs, updated_at = now()",
        )
        .bind(user_id)
        .bind(prefs)
        .execute(&self.pool)
        .await
        .map_err(db_err)?;
        Ok(())
    }
}

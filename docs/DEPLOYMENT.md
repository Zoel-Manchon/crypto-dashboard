# Deployment Guide

How to run Crypto·Watch on a small VPS (Hetzner, DigitalOcean, OVH…) with
Docker Compose, TLS, and hardened settings. Everything below assumes a fresh
Ubuntu 24.04 host you can SSH into.

## 1. Host setup

```bash
# as root, once
adduser deploy && usermod -aG sudo,docker deploy
apt-get update && apt-get install -y docker.io docker-compose-v2 ufw
ufw allow OpenSSH && ufw allow 80,443/tcp && ufw enable
```

Only 22/80/443 are open. **Do not** expose 5433 (Postgres), 9090 (Prometheus),
9093 (Alertmanager), or 3000 (Grafana) publicly.

## 2. Get the code and set real secrets

```bash
git clone https://github.com/Zoel-Manchon/crypto-dashboard.git && cd crypto-dashboard
cp .env.example .env
```

Edit `.env` and the environment in `docker-compose.yml`:

- `POSTGRES_PASSWORD` → a long random value (`openssl rand -base64 32`).
- `DATABASE_URL` → same password.
- `CORS_ALLOWED_ORIGIN` → your real site origin, e.g. `https://crypto.example.com`.
- `RATE_LIMIT_PER_MIN` → keep a sane cap (e.g. `300`).
- Grafana: set a strong `GF_SECURITY_ADMIN_PASSWORD` and turn **off** anonymous
  viewing (`GF_AUTH_ANONYMOUS_ENABLED: "false"`).

## 3. TLS in front (reverse proxy)

Terminate HTTPS with Caddy (automatic Let's Encrypt). Minimal `Caddyfile`:

```caddy
crypto.example.com {
    handle /api/* {
        reverse_proxy backend:8080
    }
    handle /metrics {
        respond 403   # never expose metrics publicly
    }
    handle {
        reverse_proxy frontend:4321
    }
}
```

Add a `caddy` service to the compose file (image `caddy:2`, ports `80:80`,
`443:443`, mount the Caddyfile) and remove the public `ports:` mappings from
`backend` and `frontend` — the proxy reaches them on the compose network.
Point the frontend's `API_BASE_URL`/`WS_URL` (in
`frontend/src/infrastructure/config.ts`) at `https://crypto.example.com` and
`wss://…` before building.

## 4. PostgreSQL with `verify-full` TLS

For a managed database (RDS, Supabase, Neon, Aiven…) or a TLS-enabled
Postgres, run the backend with certificate verification — this both encrypts
the connection and authenticates the server, defeating MITM:

```env
DATABASE_URL=postgres://crypto:***@db.example.com:5432/crypto_dashboard
DB_SSL_MODE=verify-full
DB_CA_CERT_PATH=/app/certs/ca.pem
```

Mount the CA bundle into the container:

```yaml
backend:
  volumes:
    - ./certs/ca.pem:/app/certs/ca.pem:ro
```

Your provider supplies `ca.pem` (e.g. `rds-combined-ca-bundle.pem` on AWS).
`require` encrypts but does **not** verify the server identity — use
`verify-full` in production. The in-compose dev database has no TLS, which is
why the default there is `prefer`.

## 5. Run

```bash
docker compose up -d --build
docker compose ps          # postgres + backend should report healthy
docker compose logs -f backend
```

Startup order is enforced by healthchecks (`pg_isready` → backend `/api/health`).

## 6. Operate

- **Update:** `git pull && docker compose up -d --build`
- **Backup:** `docker compose exec postgres pg_dump -U crypto crypto_dashboard | gzip > backup.sql.gz`
- **Logs:** `docker compose logs -f backend` (structured `tracing` output)
- **Monitoring:** Grafana/Prometheus stay on the private network; reach them
  over an SSH tunnel: `ssh -L 3000:localhost:3000 deploy@host`
- **Alerts:** paste a real Slack/Discord webhook into
  `observability/alertmanager.yml` (Discord: append `/slack` to the webhook URL).

## Checklist

- [ ] Strong DB + Grafana passwords, anonymous Grafana off
- [ ] `CORS_ALLOWED_ORIGIN` set to the exact site origin
- [ ] Only 80/443 (and SSH) exposed; metrics blocked at the proxy
- [ ] `DB_SSL_MODE=verify-full` + CA cert when the DB is remote
- [ ] Alertmanager webhook configured
- [ ] `docker compose ps` shows healthy services after reboot (`restart: unless-stopped` recommended)

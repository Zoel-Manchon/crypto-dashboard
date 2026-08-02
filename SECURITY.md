# Security Policy

## Reporting a vulnerability

Please open a **private security advisory** on GitHub
(*Security → Advisories → Report a vulnerability*) rather than a public issue.
Reports are acknowledged within a few days. This is a portfolio project, but
reports are taken seriously and fixed promptly.

## Supported versions

Only the latest commit on `main` is supported.

## Security posture

Measures built into this project:

| Area | Measure |
|------|---------|
| Transport | Configurable PostgreSQL TLS: `disable` / `prefer` / `require` / `verify-full` (+ custom CA via `DB_CA_CERT_PATH`) |
| HTTP | Scoped CORS (`CORS_ALLOWED_ORIGIN`), security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) |
| Abuse | Per-IP fixed-window rate limiting (`RATE_LIMIT_PER_MIN`) |
| Authentication | Argon2id password hashing (off the async runtime), JWT bearer sessions (`JWT_SECRET`, `TOKEN_TTL_HOURS`), uniform login errors, server-side input validation and prefs size caps |
| Secrets | `.env` is git-ignored; compose credentials are dev-only defaults — see the [deployment guide](docs/DEPLOYMENT.md) for production handling |
| Supply chain | Weekly `cargo audit`, `npm audit`, Trivy (vulns, secrets, misconfig) via GitHub Actions; Dependabot on cargo, npm, and Actions |
| Containers | Multi-stage build, slim runtime image, healthchecks |

## Known limitations (by design, dev defaults)

- The rate limiter is in-memory and per-instance (not distributed).
- The Docker Compose file ships development credentials and anonymous Grafana
  viewing; harden both before exposing anything publicly (see the deployment guide).
- Market-data endpoints are public by design; only `/api/prefs` requires a
  bearer token. Stored user data is limited to a credentials row and an opaque
  preferences blob.
- JWTs are stateless: there is no server-side revocation list, so tokens stay
  valid until expiry (`TOKEN_TTL_HOURS`).

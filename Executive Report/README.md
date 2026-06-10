# Executive Report

ระบบรายงานผู้บริหาร สร้างด้วย React/Vite, Express, MySQL และ Gemini PDF analysis

## Production Checklist

Detailed deploy commands are in [PRD_DEPLOY_RUNBOOK.md](PRD_DEPLOY_RUNBOOK.md).

1. Install Node.js 22 LTS and MySQL 8.
2. Create a production database and least-privilege user.
3. Copy `.env.example` to `.env` and replace every placeholder.
4. Set `SESSION_SECRET` with `openssl rand -hex 32`.
5. Set `UPLOAD_DIR` to a persistent directory outside `dist`.
6. Apply `migrations/001_production_schema.sql`.
7. Run `npm ci`.
8. Run `npm run lint`.
9. Run `npm run build`.
10. Start with `NODE_ENV=production npm start` or PM2.
11. Smoke test `/api/health`, `/api/db/health`, login, PDF upload, and report delete.

## Environment

Required production variables:

- `NODE_ENV=production`
- `WEB_PORT=3012`
- `API_PORT=3013`
- `TRUST_PROXY=loopback` when running behind a local reverse proxy, or `TRUST_PROXY=1` when there is exactly one trusted proxy hop
- `SESSION_SECRET`
- `GEMINI_API_KEY`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `UPLOAD_DIR`
- `TMP_DIR`
- `DEFAULT_ADMIN_EMAIL`, `DEFAULT_ADMIN_PASSWORD`
- `DEFAULT_EXEC_EMAIL`, `DEFAULT_EXEC_PASSWORD`
- `DEFAULT_USER_EMAIL`, `DEFAULT_USER_PASSWORD`

The default users are seeded only when the users table is empty. Change their passwords immediately after first login.

## MySQL Setup

```sql
CREATE DATABASE executive_report CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'executive_report'@'%' IDENTIFIED BY 'replace-with-strong-password';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX
ON executive_report.* TO 'executive_report'@'%';
FLUSH PRIVILEGES;
```

The app creates missing tables at startup. Keep regular MySQL backups because uploaded report metadata, acknowledgments, comments, views, and audit logs live in the database.
For production, apply [migrations/001_production_schema.sql](migrations/001_production_schema.sql) before first start so indexes, unique constraints, session revocation columns, and recoverable AI job columns exist before traffic reaches the app. Startup still runs defensive migrations for existing installs.

## Runtime Files

Uploaded PDFs are stored in `UPLOAD_DIR`. Do not point this to `dist`, because `dist` is replaced on every build. Back up this directory with the database.

Example:

```bash
sudo mkdir -p /var/lib/executive-report/uploads /tmp/executive-report
sudo chown -R $USER:$USER /var/lib/executive-report /tmp/executive-report
```

## Local Development

```bash
npm install
cp .env.example .env
npm run dev
```

For local work, `NODE_ENV` can be omitted. Production mode requires all production seed credentials and `SESSION_SECRET`.

## Build And Start

```bash
npm ci
npm run lint
npm run build
NODE_ENV=production npm start
```

PM2 example:

```bash
pm2 start dist/server.js --name executive-report --time
pm2 save
```

## Nginx Reverse Proxy

```nginx
server {
  listen 80;
  server_name reports.example.go.th;

  client_max_body_size 50m;

  location /api/ {
    proxy_pass http://127.0.0.1:3013;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /uploads/ {
    proxy_pass http://127.0.0.1:3013;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    proxy_pass http://127.0.0.1:3012;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Use HTTPS in production.

## Smoke Tests

```bash
npm run prd:smoke
```

Or check endpoints directly:

```bash
curl -fsS http://127.0.0.1:3012/
curl -fsS http://127.0.0.1:3012/api/health
curl -fsS http://127.0.0.1:3013/api/health
curl -fsS http://127.0.0.1:3013/api/db/health
```

Then verify in browser:

1. Login as admin.
2. Create a normal user.
3. Upload a PDF and wait for AI processing.
4. Open the report detail page.
5. Delete a test report and confirm the PDF is removed from `UPLOAD_DIR`.

## Security Notes

- Sessions are HMAC-signed with `SESSION_SECRET`; keep the same secret across PM2 instances.
- Sessions are checked against the current user record on every request. Disabling a user, changing role, or changing password increments `sessionVersion` and revokes existing tokens.
- The server derives `uploadedBy`, comments, acknowledgments, views, and audit log user IDs from the authenticated session.
- Admin-only endpoints are enforced server-side.
- Uploaded files are validated by PDF magic bytes and served from `UPLOAD_DIR`.
- CSP is enabled with a same-origin policy and only allows PDF rendering through same-origin/blob frames.
- AI analysis jobs are queued in MySQL and recovered on server restart if they were interrupted while processing.
- Never commit `.env` or production PDF uploads.

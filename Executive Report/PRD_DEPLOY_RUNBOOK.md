# PRD Deploy Runbook

ใช้ไฟล์นี้เป็นขั้นตอนสุดท้ายบน server จริง

## 1. Prepare Database

```bash
mysql -u executive_report -p executive_report < migrations/001_production_schema.sql
```

## 2. Configure Environment

```bash
cp .env.example .env
openssl rand -hex 32
```

ตั้งค่า `.env` จริงให้ครบ โดยเฉพาะ:

- `NODE_ENV=production`
- `WEB_PORT=3012`
- `API_PORT=3013`
- `SESSION_SECRET`
- `GEMINI_API_KEY`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `UPLOAD_DIR`
- `TMP_DIR`
- default seed users/passwords

## 3. Prepare Runtime Directories

```bash
sudo mkdir -p /var/lib/executive-report/uploads /tmp/executive-report
sudo chown -R "$USER:$USER" /var/lib/executive-report /tmp/executive-report
```

## 4. Build

```bash
npm ci
npm run lint
npm run build
```

## 5. Start

```bash
NODE_ENV=production npm start
```

PM2:

```bash
pm2 start dist/server.js --name executive-report --time
pm2 save
```

## 6. Automated Smoke Test

```bash
npm run prd:smoke
```

If the app is behind a domain or non-default port:

```bash
APP_BASE_URL=https://reports.example.go.th npm run prd:smoke
```

Direct local targets after start:

- Web: `http://127.0.0.1:3012`
- API: `http://127.0.0.1:3013`

## 7. Manual Smoke Test

1. Login as admin.
2. Upload a PDF and confirm the summary is a short bullet list.
3. Retry analysis and confirm the queued job completes.
4. Disable a test user or change its role, then confirm the old session is forced to login again.
5. Delete a test report and confirm the PDF is removed from `UPLOAD_DIR`.

## Rollback

Keep the previous release directory and `.env` unchanged until smoke tests pass.

If smoke tests fail:

```bash
pm2 stop executive-report
pm2 start /path/to/previous-release/dist/server.js --name executive-report --time
pm2 save
```

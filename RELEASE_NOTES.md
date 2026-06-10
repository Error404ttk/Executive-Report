# Release Notes

## v1.0.0-prd-ready - 2026-06-10

### Added

- Production deploy runbook at `Executive Report/PRD_DEPLOY_RUNBOOK.md`.
- PRD smoke test script at `Executive Report/scripts/prd-smoke-test.sh`.
- MySQL production schema migration at `Executive Report/migrations/001_production_schema.sql`.
- Root README for GitHub repository visibility.

### Changed

- Web listener now defaults to port `3012`; API listener now defaults to port `3013`.
- Web server proxies `/api` and `/uploads` to the API listener so existing frontend calls keep working.
- PDF AI summaries are normalized into short Thai bullet points for executive reading.
- Build output now uses `dist/server.js` as the production server entrypoint.
- Uploaded files are stored through configurable `UPLOAD_DIR` instead of build output paths.
- Runtime config is documented through `Executive Report/.env.example`.

### Security

- Session tokens are HMAC-signed and verified against current DB user state on each request.
- Existing tokens are revoked immediately when a user is disabled or when role/password changes increment `sessionVersion`.
- CSP is enabled with a constrained same-origin policy and PDF-safe frame directives.
- Server derives user identity for uploads, comments, views, acknowledgments, and audit logs from the authenticated session.
- PDF uploads are validated with magic-byte MIME detection.
- `.env`, local JSON data, uploaded PDFs, build output, dependency folders, logs, and zip archives are ignored by git.

### Reliability

- AI analysis jobs are persisted in MySQL as queued jobs.
- Interrupted `processing` jobs are restored to `queued` on server startup.
- Health endpoints are available at `/api/health` and `/api/db/health`.

### Validation

- `npm run lint` passed.
- `npm run build` passed.
- `bash -n Executive Report/scripts/prd-smoke-test.sh` passed.

### Known Notes

- Vite reports a non-blocking large JS chunk warning. This does not block PRD, but route-level code splitting is a future performance improvement.

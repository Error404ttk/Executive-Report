# Executive Report

Production-ready executive report system for PDF upload, AI bullet-summary analysis, executive acknowledgment, comments, audit trail, and admin management.

The application source is in [`Executive Report/`](Executive%20Report/).

## Current Release

See [`RELEASE_NOTES.md`](RELEASE_NOTES.md) for the production readiness release notes.

## Production Deploy

Use the deploy runbook before opening production traffic:

1. Apply [`Executive Report/migrations/001_production_schema.sql`](Executive%20Report/migrations/001_production_schema.sql).
2. Create `Executive Report/.env` from [`Executive Report/.env.example`](Executive%20Report/.env.example).
3. Set real `SESSION_SECRET`, database credentials, Gemini API key, and runtime upload paths.
4. Run checks and build:

```bash
cd "Executive Report"
npm ci
npm run lint
npm run build
```

5. Start production and run the smoke gate:

```bash
NODE_ENV=production npm start
npm run prd:smoke
```

Detailed commands are in [`Executive Report/PRD_DEPLOY_RUNBOOK.md`](Executive%20Report/PRD_DEPLOY_RUNBOOK.md).

## Security Notes

- Real `.env`, uploaded PDFs, local DB JSON, build output, and dependency folders are intentionally ignored by git.
- Sessions are HMAC-signed and checked against the active user record on every request.
- Disabling users or changing role/password revokes existing tokens through `sessionVersion`.
- AI analysis jobs are queued in MySQL and recovered after server restart.
- CSP is enabled with a same-origin policy and PDF-safe frame rules.

## Repository Hygiene

Do not commit:

- `Executive Report/.env`
- `Executive Report/db.json`
- `Executive Report/public/uploads/`
- `Executive Report/dist/`
- `Executive Report/node_modules/`
- `*.zip`

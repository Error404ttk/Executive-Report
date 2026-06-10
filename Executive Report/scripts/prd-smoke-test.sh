#!/usr/bin/env bash
set -euo pipefail

APP_BASE_URL="${APP_BASE_URL:-http://127.0.0.1:${PORT:-3000}}"
ENV_FILE="${ENV_FILE:-.env}"

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

pass() {
  printf 'OK: %s\n' "$1"
}

require_file() {
  local file="$1"
  [[ -f "$file" ]] || fail "missing file: $file"
  pass "found $file"
}

require_env_key() {
  local key="$1"
  grep -Eq "^${key}=.+" "$ENV_FILE" || fail "missing env key: $key"
}

env_value() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" | tail -n 1 | cut -d '=' -f 2- | sed -e 's/^"//' -e 's/"$//'
}

printf 'Executive Report PRD smoke test\n'
printf 'Target: %s\n\n' "$APP_BASE_URL"

require_file "$ENV_FILE"
require_file "dist/server.js"
require_file "dist/index.html"
require_file "migrations/001_production_schema.sql"

for key in \
  NODE_ENV PORT SESSION_SECRET GEMINI_API_KEY \
  DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME \
  UPLOAD_DIR TMP_DIR \
  DEFAULT_ADMIN_EMAIL DEFAULT_ADMIN_PASSWORD \
  DEFAULT_EXEC_EMAIL DEFAULT_EXEC_PASSWORD \
  DEFAULT_USER_EMAIL DEFAULT_USER_PASSWORD
do
  require_env_key "$key"
done
pass "required env keys present"

if [[ "$(env_value NODE_ENV)" != "production" ]]; then
  fail "NODE_ENV must be production"
fi
pass "NODE_ENV=production"

SESSION_SECRET_VALUE="$(env_value SESSION_SECRET)"
if [[ "$SESSION_SECRET_VALUE" == *replace* || ${#SESSION_SECRET_VALUE} -lt 32 ]]; then
  fail "SESSION_SECRET is too short or still a placeholder"
fi
pass "SESSION_SECRET looks configured"

UPLOAD_DIR_VALUE="$(env_value UPLOAD_DIR)"
TMP_DIR_VALUE="$(env_value TMP_DIR)"
[[ -d "$UPLOAD_DIR_VALUE" ]] || fail "UPLOAD_DIR does not exist: $UPLOAD_DIR_VALUE"
[[ -w "$UPLOAD_DIR_VALUE" ]] || fail "UPLOAD_DIR is not writable: $UPLOAD_DIR_VALUE"
[[ -d "$TMP_DIR_VALUE" ]] || fail "TMP_DIR does not exist: $TMP_DIR_VALUE"
[[ -w "$TMP_DIR_VALUE" ]] || fail "TMP_DIR is not writable: $TMP_DIR_VALUE"
pass "runtime directories exist and are writable"

curl -fsS "${APP_BASE_URL}/api/health" >/dev/null || fail "/api/health failed"
pass "/api/health"

curl -fsS "${APP_BASE_URL}/api/db/health" >/dev/null || fail "/api/db/health failed"
pass "/api/db/health"

printf '\nManual browser checks still required:\n'
printf '1. Login as admin\n'
printf '2. Upload PDF and verify bullet summary\n'
printf '3. Retry analysis and verify queued job completes\n'
printf '4. Disable or edit user role and confirm old session is revoked\n'
printf '5. Delete a test report and confirm PDF is removed from UPLOAD_DIR\n'

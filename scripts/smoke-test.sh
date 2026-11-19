#!/usr/bin/env bash
# End-to-end smoke test against a running stack.  Usage: ./scripts/smoke-test.sh [base_url]
set -euo pipefail
BASE="${1:-http://localhost:3000}"
EMAIL="smoke-$(date +%s)@example.com"
pass() { printf '  \033[32m✔\033[0m %s\n' "$1"; }

echo "Smoke testing $BASE"
curl -fsS "$BASE/healthz" >/dev/null && pass "frontend healthy"
curl -fsS "$BASE/api/info" | grep -q '"database"' && pass "backend reachable through nginx"
TOKEN=$(curl -fsS -X POST "$BASE/api/auth/register" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Smoke\",\"email\":\"$EMAIL\",\"password\":\"Smoke1234\"}" | sed -E 's/.*"token":"([^"]+)".*/\1/')
[ -n "$TOKEN" ] && pass "register + JWT issued"
curl -fsS -X POST "$BASE/api/tasks" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Smoke task","priority":"high"}' | grep -q '"Smoke task"' && pass "task created"
curl -fsS "$BASE/api/tasks/stats" -H "Authorization: Bearer $TOKEN" | grep -q '"total":1' && pass "stats correct"
curl -fsSI "$BASE/" | grep -qi 'content-security-policy' && pass "security headers present"
echo "All smoke tests passed."

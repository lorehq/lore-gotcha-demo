#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8787}"

check_count() {
  local from="$1"
  local to="$2"
  local expected="$3"

  local url="${BASE_URL}/api/v1/orders?from=${from}&to=${to}"
  local body
  body="$(curl -sS "$url")"

  local count
  count="$(printf '%s' "$body" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);process.stdout.write(String(j.count));});')"

  if [ "$count" = "$expected" ]; then
    printf 'PASS %s to %s -> count=%s\n' "$from" "$to" "$count"
  else
    printf 'FAIL %s to %s -> expected=%s actual=%s\n' "$from" "$to" "$expected" "$count"
    exit 1
  fi
}

check_count "2026-02-09" "2026-02-15" "2"
check_count "2026-02-13" "2026-02-20" "3"

echo "Verification complete."

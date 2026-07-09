#!/usr/bin/env bash
# Quick smoke test for PayGram production API
set -euo pipefail

BASE="${1:-https://paygram-rust.vercel.app}"

echo "=== Health ==="
curl -sf "$BASE/api/health" | jq .

echo "=== Register test user ==="
curl -sf -X POST "$BASE/api/user-registry" \
  -H 'Content-Type: application/json' \
  -d '{"username":"smoketest","walletAddress":"0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"}' | jq .

echo "=== Resolve test user ==="
curl -sf "$BASE/api/user-registry?handle=smoketest" | jq .

echo "=== List users ==="
curl -sf "$BASE/api/user-registry" | jq .

echo "OK — all checks passed"

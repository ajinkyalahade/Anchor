#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

PATTERN='(sk-ant-[A-Za-z0-9_-]{10,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN (RSA|EC|OPENSSH|PRIVATE) KEY-----)'

if rg \
  --hidden \
  --glob '!**/.git/**' \
  --glob '!**/.venv/**' \
  --glob '!**/node_modules/**' \
  --glob '!**/dist/**' \
  --glob '!**/.env.example' \
  --glob '!**/PRODUCTION_PLAN.md' \
  --glob '!**/package-lock.json' \
  -n "$PATTERN" .; then
  echo "Potential hardcoded secrets found."
  exit 1
fi

echo "No hardcoded secret patterns detected."

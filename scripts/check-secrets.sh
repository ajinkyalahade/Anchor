#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Without this guard, a missing rg exits 127 inside `if`, which reads as
# "no matches" — a silent false pass.
if ! command -v rg >/dev/null 2>&1; then
  echo "error: ripgrep (rg) is required — brew install ripgrep" >&2
  exit 2
fi

PATTERN='(sk-ant-[A-Za-z0-9_-]{10,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN (RSA|EC|OPENSSH|PRIVATE) KEY-----)'

if rg \
  --hidden \
  --glob '!**/.git/**' \
  --glob '!**/.venv/**' \
  --glob '!**/node_modules/**' \
  --glob '!**/dist/**' \
  --glob '!**/.env.example' \
  --glob '!**/package-lock.json' \
  -n "$PATTERN" .; then
  echo "Potential hardcoded secrets found."
  exit 1
fi

echo "No hardcoded secret patterns detected."

#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_PORT="${BACKEND_PORT:-5174}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

python -m flask --app backend.run run --debug --port "${BACKEND_PORT}" &
BACKEND_PID=$!

npm --prefix "${ROOT_DIR}/frontend" run dev -- --host 127.0.0.1 --port "${FRONTEND_PORT}" &
FRONTEND_PID=$!

cleanup() {
  kill "${BACKEND_PID}" "${FRONTEND_PID}" 2>/dev/null || true
}

trap cleanup EXIT INT TERM
wait

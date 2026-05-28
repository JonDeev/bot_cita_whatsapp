#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-}"
SESSION_COOKIE="${2:-}"
CSRF_TOKEN="${3:-}"

if [[ -z "${BASE_URL}" ]]; then
  echo "Usage: $0 <base_url> [session_cookie] [csrf_token]"
  echo "Example: $0 https://admin.example.com \"__Host-sism_admin_session=...\" \"...\""
  exit 1
fi

echo "[1/4] Checking /api/admin/auth/me without session (expect 401)"
curl -isk "${BASE_URL}/api/admin/auth/me" | head -n 1

if [[ -n "${SESSION_COOKIE}" ]]; then
  echo "[2/4] Checking /api/admin/auth/csrf with session (expect 200)"
  curl -isk "${BASE_URL}/api/admin/auth/csrf" \
    -H "Cookie: ${SESSION_COOKIE}" | head -n 20

  echo "[3/4] Checking /api/admin/stream headers with session"
  curl -iskN "${BASE_URL}/api/admin/stream" \
    -H "Cookie: ${SESSION_COOKIE}" | head -n 30
fi

if [[ -n "${SESSION_COOKIE}" && -n "${CSRF_TOKEN}" ]]; then
  echo "[4/4] Checking /api/admin/auth/logout with csrf (expect success)"
  curl -isk -X POST "${BASE_URL}/api/admin/auth/logout" \
    -H "Cookie: ${SESSION_COOKIE}" \
    -H "X-CSRF-Token: ${CSRF_TOKEN}" | head -n 20
fi

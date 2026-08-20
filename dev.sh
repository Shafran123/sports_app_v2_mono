#!/usr/bin/env bash
# Run frontend (sp_fe, :3000) and backend (sp_be, :2400) together.
# Usage: ./dev.sh   (first-time setup happens automatically)
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f sp_be/.env ]; then
  cp sp_be/.env.example sp_be/.env
  echo "Created sp_be/.env (edit it: DATABASE_URL + GOOGLE_APPLICATION_CREDENTIALS)"
fi
if [ ! -f sp_fe/.env.local ]; then
  cp sp_fe/.env.example sp_fe/.env.local
  echo "Created sp_fe/.env.local (edit it: NEXT_PUBLIC_FIREBASE_* vars)"
fi

if ! psql -lqt 2>/dev/null | cut -d'|' -f1 | grep -qw sports_dev; then
  createdb sports_dev
  (cd sp_be && DATABASE_URL=postgres://localhost:5432/sports_dev npm run db:setup)
elif [ -z "$(psql -d sports_dev -tAc "select count(*) from information_schema.tables where table_name='sports'" 2>/dev/null)" ]; then
  (cd sp_be && DATABASE_URL=postgres://localhost:5432/sports_dev npm run db:setup)
fi

trap 'kill 0' EXIT INT TERM
(cd sp_be && npm run dev) &
(cd sp_fe && npm run dev) &
wait
#!/bin/sh
set -e

echo "[entrypoint] applying database migrations..."
node dist/scripts/migrate.js

echo "[entrypoint] seeding reference data (idempotent)..."
node dist/scripts/seed.js

echo "[entrypoint] starting server..."
exec node dist/main.js

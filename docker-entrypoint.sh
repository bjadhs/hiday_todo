#!/bin/sh
# Apply DB migrations and seed defaults before starting the server, so a fresh
# Postgres is provisioned automatically on first deploy. Both steps are
# idempotent and safe to run on every container start.
set -e

echo "entrypoint: running migrations"
node scripts/migrate.mjs

echo "entrypoint: seeding defaults"
node scripts/seed.mjs

echo "entrypoint: starting server"
exec node server.js

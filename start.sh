#!/bin/sh
# Railway startup script
# Runs prisma db push to sync the schema with the database (creates missing columns/tables)
# then starts Next.js

set -e

echo "=== Syncing Prisma schema with database ==="
npx prisma db push --accept-data-loss --schema=./prisma/schema.prisma || {
  echo "WARNING: prisma db push failed. Continuing anyway — the app may have issues if the schema is out of sync."
}

echo "=== Starting Next.js ==="
exec node_modules/.bin/next start

#!/usr/bin/env bash

set -euo pipefail

echo "🧹 Resetting database with fresh schema and seed data..."
# Note: migrate reset automatically runs the seed command (from package.json)
npx prisma migrate reset --force --skip-generate
echo "✅ Database reset complete!"

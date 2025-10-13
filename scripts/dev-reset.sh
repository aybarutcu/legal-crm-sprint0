#!/usr/bin/env bash

set -euo pipefail

echo "🧹 Resetting database with fresh schema and seed data..."
npx prisma migrate reset --force --skip-generate
npm run db:seed

#!/bin/sh
set -e
npx prisma db push --schema=apps/api/prisma/schema.prisma --accept-data-loss || true
exec node /app/apps/api/dist/main.js

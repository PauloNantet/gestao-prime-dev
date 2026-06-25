#!/bin/sh
npx prisma db push --schema=apps/api/prisma/schema.prisma --accept-data-loss --skip-generate || true
exec node /app/apps/api/dist/src/main.js

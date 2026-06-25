FROM node:22-alpine AS base
WORKDIR /app
RUN npm install -g turbo prisma

FROM base AS deps
COPY package.json package-lock.json turbo.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/shared/tsconfig.json packages/shared/
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN turbo build

FROM base AS runner
COPY --from=deps /app/package.json /app/package-lock.json ./
COPY --from=deps /app/apps/api/package.json ./apps/api/
COPY --from=deps /app/apps/web/package.json ./apps/web/
COPY --from=deps /app/packages/shared/package.json ./packages/shared/
RUN npm ci --omit=dev

COPY --from=builder /app/apps/api/dist /app/apps/api/dist
COPY --from=builder /app/apps/web/dist /app/apps/web/dist
COPY --from=builder /app/apps/api/prisma /app/apps/api/prisma
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
COPY --from=builder /app/packages/shared/dist /app/packages/shared/dist
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV NODE_ENV=production

CMD ["/app/entrypoint.sh"]

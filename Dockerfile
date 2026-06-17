FROM node:22-alpine AS base
WORKDIR /app
RUN npm install -g turbo prisma

FROM base AS deps
COPY package.json package-lock.json turbo.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
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

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/web/dist ./apps/web/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

EXPOSE 3001

ENV NODE_ENV=production
ENV API_PORT=3001

CMD ["node", "apps/api/dist/main.js"]

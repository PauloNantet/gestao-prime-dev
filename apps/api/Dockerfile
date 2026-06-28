FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable
COPY package.json package-lock.json* turbo.json .nvmrc* ./

FROM base AS prebuild
RUN npm ci --prefer-offline --no-audit

FROM prebuild AS build-api
COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN npx nest build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=prebuild /app/node_modules ./node_modules
COPY --from=build-api /app/apps/api/dist ./apps/api/dist

COPY apps/api/package.json apps/api/package-lock.json* ./apps/api/

ENV NODE_ENV=production
ENV API_PORT=3001

COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

EXPOSE 3001

CMD ["./entrypoint.sh"]
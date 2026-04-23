# Web (Next + custom server.js) and worker (node worker.js + jiti) share dependency install
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci
# Ensure Prisma client is generated in deps stage so builder/web stages have prisma available
RUN npx prisma generate

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Next can omit `public/` if there are no static assets; `COPY public` in web stage still needs the path
RUN mkdir -p public
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- Public HTTP app (behind host nginx) ---
FROM base AS web
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8081
ENV HOSTNAME=0.0.0.0
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server.js ./server.js
EXPOSE 8081
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node server.js"]

# --- Background worker (same env as web, no public port) ---
FROM base AS worker
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY worker.js ./
COPY src ./src
CMD ["node", "worker.js"]

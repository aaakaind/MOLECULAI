FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

# Build stage (if needed)
FROM base AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 moleculai

COPY --from=deps --chown=moleculai:nodejs /app/node_modules ./node_modules
COPY --chown=moleculai:nodejs . .

USER moleculai

EXPOSE 4000

CMD ["node", "server.js"]

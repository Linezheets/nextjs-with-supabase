# ── Deps stage (prod-only) ─────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ── Build stage (all deps including devDeps for TypeScript types) ─────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Install ALL deps (including devDependencies like @types/*) so TypeScript can type-check
RUN npm ci
COPY . .

# Ensure public/ always exists (guards COPY in runner even if dir is empty)
RUN mkdir -p public

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Production stage ────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# PORT is set by Railway at runtime; default 3000 matches Next.js standalone default
ENV PORT=3000

# Run as non-root for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy prod-only node_modules from deps stage
COPY --from=deps    --chown=nextjs:nodejs /app/node_modules    ./node_modules
# Copy built artifacts from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/public            ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone  .
COPY --from=builder --chown=nextjs:nodejs /app/.next/static      ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]

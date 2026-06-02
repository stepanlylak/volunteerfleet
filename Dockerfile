# syntax=docker/dockerfile:1

# ─── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-bookworm AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV HUSKY=0
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

# Install dependencies (layer cached on manifests only)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/server/package.json apps/server/package.json
COPY apps/client/package.json apps/client/package.json
RUN pnpm install --frozen-lockfile

# Build shared → client → server
COPY . .
RUN pnpm --filter @volunteerfleet/shared build \
  && pnpm --filter @volunteerfleet/client build \
  && pnpm --filter @volunteerfleet/server build

# Self-contained production bundle for the server (bundles @volunteerfleet/shared)
RUN pnpm --filter=@volunteerfleet/server deploy --prod /prod

# ─── Runtime stage ────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV CLIENT_DIST_PATH=/app/client
ENV MIGRATIONS_FOLDER=/app/drizzle
WORKDIR /app

# Server bundle: dist/, drizzle/, data/, node_modules/, package.json
COPY --from=build /prod ./
# Built client static assets (served by the server in production)
COPY --from=build /repo/apps/client/dist ./client
# Startup script: migrate → seed → serve
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

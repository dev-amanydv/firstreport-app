# One image for every app; docker-compose picks the command. Scripts run with tsx, as in dev.
FROM node:24-slim
RUN npm install -g pnpm@12.8.1
WORKDIR /app

# Manifests first, so a code change does not reinstall dependencies.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY apps/worker/package.json apps/worker/
COPY apps/api/package.json apps/api/
# The lockfile lists the mobile app, so its manifest must be here; its dependencies are not installed.
COPY apps/mobile/package.json apps/mobile/
RUN pnpm install --frozen-lockfile --filter '!@fr/mobile'

COPY . .
ENV NODE_ENV=production

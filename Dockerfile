# One image for every app; docker-compose picks the command. Scripts run with tsx, as in dev.
FROM node:24-slim
RUN npm install -g pnpm@12.8.1
WORKDIR /app

# Manifests first, so a code change does not reinstall dependencies.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY apps/worker/package.json apps/worker/
RUN pnpm install --frozen-lockfile

COPY . .
ENV NODE_ENV=production

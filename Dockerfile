# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-slim AS builder

# Enable corepack and install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace-level files first (better layer caching)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./

# Copy package.json for every workspace package
COPY frontend-gestao-revestimento/package.json                    ./frontend-gestao-revestimento/
COPY frontend-gestao-revestimento/tsconfig.json                   ./frontend-gestao-revestimento/
COPY frontend-gestao-revestimento/tsconfig.base.json              ./frontend-gestao-revestimento/
COPY frontend-gestao-revestimento/lib/api-client-react/package.json ./frontend-gestao-revestimento/lib/api-client-react/
COPY frontend-gestao-revestimento/lib/api-zod/package.json        ./frontend-gestao-revestimento/lib/api-zod/
COPY frontend-gestao-revestimento/lib/db/package.json             ./frontend-gestao-revestimento/lib/db/

# Install ALL dependencies (dev included — needed for tsx + vite build)
RUN pnpm install --frozen-lockfile

# Copy the rest of the source
COPY frontend-gestao-revestimento ./frontend-gestao-revestimento/

# Build the Vite frontend (static output → dist/public)
RUN PORT=8080 BASE_PATH=/ pnpm --filter @workspace/redeasso run build

# ─── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM node:22-slim AS runtime

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Workspace manifests
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY frontend-gestao-revestimento/package.json                    ./frontend-gestao-revestimento/
COPY frontend-gestao-revestimento/tsconfig.base.json              ./frontend-gestao-revestimento/
COPY frontend-gestao-revestimento/lib/api-client-react/package.json ./frontend-gestao-revestimento/lib/api-client-react/
COPY frontend-gestao-revestimento/lib/api-zod/package.json        ./frontend-gestao-revestimento/lib/api-zod/
COPY frontend-gestao-revestimento/lib/db/package.json             ./frontend-gestao-revestimento/lib/db/

# Install production deps only (express) + tsx for running the server TS file
# tsx is a devDep so we install all deps but skip heavy build-only tools
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy built frontend from builder stage
COPY --from=builder /app/frontend-gestao-revestimento/dist ./frontend-gestao-revestimento/dist

# Copy server source
COPY frontend-gestao-revestimento/server ./frontend-gestao-revestimento/server

EXPOSE 8080

ENV PORT=8080
ENV NODE_ENV=production

CMD ["./frontend-gestao-revestimento/node_modules/.bin/tsx", "frontend-gestao-revestimento/server/index.ts"]

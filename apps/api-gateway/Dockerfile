# syntax=docker/dockerfile:1
# Build from the REPO ROOT: docker build -f apps/api-gateway/Dockerfile .

FROM node:20-alpine AS pruner
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm dlx turbo@2 prune @lilochat/api-gateway --docker

FROM node:20-alpine AS builder
WORKDIR /repo
RUN corepack enable && apk add --no-cache libc6-compat
COPY --from=pruner /repo/out/full/ .
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile
RUN pnpm turbo build --filter=@lilochat/api-gateway

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /repo .
USER app
EXPOSE 4100
CMD ["node", "apps/api-gateway/dist/main.js"]

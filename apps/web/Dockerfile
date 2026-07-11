# syntax=docker/dockerfile:1
# Build from the REPO ROOT: docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://api.example.com .
# NEXT_PUBLIC_* vars are inlined into the client bundle AT BUILD TIME.

FROM node:20-alpine AS pruner
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm dlx turbo@2 prune @lilochat/web --docker

FROM node:20-alpine AS builder
WORKDIR /repo
RUN corepack enable && apk add --no-cache libc6-compat
COPY --from=pruner /repo/out/full/ .
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm turbo build --filter=@lilochat/web

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
# Next standalone output: self-contained server with only needed node_modules
COPY --from=builder --chown=app:app /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=app:app /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=app:app /repo/apps/web/public ./apps/web/public
USER app
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

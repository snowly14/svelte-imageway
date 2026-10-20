FROM oven/bun:1.4.3 AS dependencies
WORKDIR /app
COPY packages/edge/server-package.json package.json
COPY packages/edge/server.bun.lock bun.lock
RUN bun install --production --frozen-lockfile

FROM node:24.22.0-bookworm-slim
ENV NODE_ENV=production PORT=3000 IMAGEWAY_SOURCE_ROOT=/sources IMAGEWAY_CACHE_DIR=/cache
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY packages/edge/server-package.json ./package.json
COPY packages/svelte-imageway/dist ./packages/svelte-imageway/dist
COPY packages/edge/server.mjs ./packages/edge/server.mjs
RUN mkdir /sources /cache && chown node:node /sources /cache
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "packages/edge/server.mjs"]

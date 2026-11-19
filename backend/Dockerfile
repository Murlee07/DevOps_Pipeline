# ---------- Stage 1: install production dependencies ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev --no-audit --no-fund; \
    else npm install --omit=dev --no-audit --no-fund; fi \
 && npm cache clean --force

# ---------- Stage 2: minimal, hardened runtime ----------
FROM node:22-alpine AS runtime

ARG APP_VERSION=1.0.0
ARG GIT_COMMIT=unknown
ARG BUILD_NUMBER=local

LABEL org.opencontainers.image.title="shieldboard-backend" \
      org.opencontainers.image.description="ShieldBoard REST API" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${GIT_COMMIT}" \
      org.opencontainers.image.source="https://github.com/murlee7/secure-devsecops-pipeline"

ENV NODE_ENV=production \
    PORT=5000 \
    APP_VERSION=${APP_VERSION} \
    GIT_COMMIT=${GIT_COMMIT} \
    BUILD_NUMBER=${BUILD_NUMBER}

# Patch OS packages and remove npm/corepack (not needed at runtime -> smaller attack surface, fewer CVEs)
RUN apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

WORKDIR /app
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

USER node
EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:5000/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "src/server.js"]

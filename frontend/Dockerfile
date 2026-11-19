# ---------- Stage 1: build the React app ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; \
    else npm install --no-audit --no-fund; fi
COPY . .
RUN npm run build

# ---------- Stage 2: serve with unprivileged nginx ----------
FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime

ARG APP_VERSION=1.0.0
ARG GIT_COMMIT=unknown

LABEL org.opencontainers.image.title="shieldboard-frontend" \
      org.opencontainers.image.description="ShieldBoard web UI" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${GIT_COMMIT}" \
      org.opencontainers.image.source="https://github.com/murlee7/secure-devsecops-pipeline"

USER root
RUN apk upgrade --no-cache && mkdir -p /etc/nginx/snippets
USER 101

# Where /api/* is proxied to. Same service name ("backend") in Compose and Kubernetes.
ENV BACKEND_URL=http://backend:5000

COPY --chown=101:101 nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --chown=101:101 nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build --chown=101:101 /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

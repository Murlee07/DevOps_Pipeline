#!/usr/bin/env bash
# Build images and deploy ShieldBoard to Docker Desktop Kubernetes without Jenkins.
# Usage: ./scripts/k8s-local-deploy.sh            -> http://localhost:8081
set -euo pipefail
cd "$(dirname "$0")/.."

REGISTRY="${DOCKER_REGISTRY:-murlee7}"
TAG="${IMAGE_TAG:-local}"
NS=shieldboard
DB_PASSWORD="${APP_DB_PASSWORD:-$(openssl rand -hex 16)}"
JWT_SECRET="${APP_JWT_SECRET:-$(openssl rand -hex 32)}"

kubectl config use-context docker-desktop

docker build -t "$REGISTRY/shieldboard-backend:$TAG" backend
docker build -t "$REGISTRY/shieldboard-frontend:$TAG" frontend

kubectl create namespace "$NS" --dry-run=client -o yaml | kubectl apply -f -
if ! kubectl -n "$NS" get secret shieldboard-secrets >/dev/null 2>&1; then
  kubectl -n "$NS" create secret generic shieldboard-secrets \
    --from-literal=POSTGRES_PASSWORD="$DB_PASSWORD" \
    --from-literal=JWT_SECRET="$JWT_SECRET" \
    --from-literal=DATABASE_URL="postgres://shieldboard:${DB_PASSWORD}@postgres:5432/shieldboard"
fi

kubectl apply -k k8s/overlays/local
kubectl -n "$NS" set image deployment/backend backend="$REGISTRY/shieldboard-backend:$TAG"
kubectl -n "$NS" set image deployment/frontend frontend="$REGISTRY/shieldboard-frontend:$TAG"
kubectl -n "$NS" rollout status statefulset/postgres --timeout=180s
kubectl -n "$NS" rollout status deployment/backend --timeout=240s
kubectl -n "$NS" rollout status deployment/frontend --timeout=180s
kubectl -n "$NS" get pods,svc
echo "ShieldBoard is running on http://localhost:8081"

# Build images and deploy ShieldBoard to Docker Desktop Kubernetes (Windows PowerShell).
# Usage:  .\scripts\k8s-local-deploy.ps1        -> http://localhost:8081
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$Registry = if ($env:DOCKER_REGISTRY) { $env:DOCKER_REGISTRY } else { "murlee7" }
$Tag      = if ($env:IMAGE_TAG) { $env:IMAGE_TAG } else { "local" }
$Ns       = "shieldboard"
function New-Secret([int]$bytes) { -join ((1..$bytes) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) }) }
$DbPassword = if ($env:APP_DB_PASSWORD) { $env:APP_DB_PASSWORD } else { New-Secret 16 }
$JwtSecret  = if ($env:APP_JWT_SECRET) { $env:APP_JWT_SECRET } else { New-Secret 32 }

kubectl config use-context docker-desktop

docker build -t "$Registry/shieldboard-backend:$Tag" backend
docker build -t "$Registry/shieldboard-frontend:$Tag" frontend

kubectl create namespace $Ns --dry-run=client -o yaml | kubectl apply -f -
kubectl -n $Ns get secret shieldboard-secrets 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  kubectl -n $Ns create secret generic shieldboard-secrets `
    --from-literal=POSTGRES_PASSWORD=$DbPassword `
    --from-literal=JWT_SECRET=$JwtSecret `
    --from-literal=DATABASE_URL="postgres://shieldboard:$DbPassword@postgres:5432/shieldboard"
}

kubectl apply -k k8s/overlays/local
kubectl -n $Ns set image deployment/backend  "backend=$Registry/shieldboard-backend:$Tag"
kubectl -n $Ns set image deployment/frontend "frontend=$Registry/shieldboard-frontend:$Tag"
kubectl -n $Ns rollout status statefulset/postgres --timeout=180s
kubectl -n $Ns rollout status deployment/backend  --timeout=240s
kubectl -n $Ns rollout status deployment/frontend --timeout=180s
kubectl -n $Ns get pods,svc
Write-Host "ShieldBoard is running on http://localhost:8081" -ForegroundColor Green

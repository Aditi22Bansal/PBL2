<#
.SYNOPSIS
    Brings RoomSync's K8s deployment back up on the existing devops-lab kind cluster.

.DESCRIPTION
    Re-applies all of k8s/ in the correct dependency order (namespace -> configmap/
    secret -> mongo -> python-service -> backend -> frontend -> monitoring/). Every
    image reference is a GHCR tag, so this is a pull, never a rebuild - fast.

    Deliberately does NOT create or delete the devops-lab kind cluster itself - it's
    a shared cluster (see scripts/dev-down-all.ps1's own note) that this project
    doesn't own outright, and its exact original creation parameters aren't captured
    anywhere in this repo. If the cluster doesn't exist at all, this script reports
    that clearly instead of guessing at how to recreate it.
#>

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$ctx = "kind-devops-lab"

Write-Host "== RoomSync: bring K8s back up ==" -ForegroundColor Cyan
Write-Host ""

$clusters = kind get clusters 2>$null
if (-not ($clusters -contains "devops-lab")) {
    Write-Host "The devops-lab kind cluster doesn't exist on this machine." -ForegroundColor Red
    Write-Host "This script won't create it (unknown original config) - if you need a" -ForegroundColor Yellow
    Write-Host "fresh one, the closest reproduction is:" -ForegroundColor Yellow
    Write-Host "  kind create cluster --name devops-lab --image kindest/node:v1.32.2" -ForegroundColor Yellow
    Write-Host "then re-run this script." -ForegroundColor Yellow
    exit 1
}
Write-Host "devops-lab cluster found." -ForegroundColor Green
Write-Host ""

Push-Location $repoRoot
try {
    Write-Host "Applying k8s/ in dependency order..." -ForegroundColor Cyan

    kubectl apply -f k8s/namespace.yaml --context $ctx
    kubectl apply -f k8s/configmap.yaml -f k8s/secret.yaml --context $ctx
    kubectl apply -f k8s/mongo.yaml --context $ctx
    kubectl apply -f k8s/python-service.yaml --context $ctx
    kubectl apply -f k8s/backend.yaml --context $ctx
    kubectl apply -f k8s/frontend.yaml --context $ctx

    Write-Host ""
    Write-Host "Applying k8s/monitoring/ (namespace first, so the rest doesn't race it)..." -ForegroundColor Cyan
    kubectl apply -f k8s/monitoring/namespace.yaml --context $ctx
    kubectl apply -f k8s/monitoring/ --context $ctx

    Write-Host ""
    Write-Host "Waiting for roomsync pods to become Ready..." -ForegroundColor Cyan
    kubectl wait --for=condition=Ready pod --all -n roomsync --context $ctx --timeout=120s

    Write-Host ""
    Write-Host "Done. Current state:" -ForegroundColor Green
    kubectl get pods -n roomsync --context $ctx
    kubectl get pods -n monitoring --context $ctx
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "To release this back to idle when you're done: scripts/dev-down-all.ps1" -ForegroundColor DarkGray

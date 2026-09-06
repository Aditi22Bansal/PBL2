<#
.SYNOPSIS
    Releases everything RoomSync's local dev/verification work leaves running, back
    to idle - Docker Compose stack and the roomsync/monitoring K8s namespaces.

.DESCRIPTION
    - `docker compose down`, but only if the compose stack is actually up.
    - Deletes the `roomsync` and `monitoring` namespaces in the `devops-lab` kind
      cluster, but only if that cluster/namespace actually exists.

    Deliberately does NOT delete the `devops-lab` kind cluster itself - it's a
    shared cluster with other unrelated namespaces on it (apache-demo,
    microservices-demo, mongo-lab, social-media, ...) that have nothing to do with
    this project. Only RoomSync's own two namespaces are touched.

    Checks what's actually running first and skips cleanly (no error) if something
    is already down - safe to run any time, including when nothing is up at all.
#>

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

Write-Host "== RoomSync: release everything back to idle ==" -ForegroundColor Cyan
Write-Host ""

# --- Docker Compose stack ---
Write-Host "Checking Docker Compose stack..." -ForegroundColor Cyan
docker info *>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Docker Desktop isn't running - nothing to tear down there." -ForegroundColor DarkGray
} else {
    Push-Location $repoRoot
    try {
        $running = docker compose ps -q 2>$null
        if ($running) {
            Write-Host "  Compose stack is up - running 'docker compose down'..." -ForegroundColor Yellow
            docker compose down
            Write-Host "  Done." -ForegroundColor Green
        } else {
            Write-Host "  Compose stack is already down." -ForegroundColor DarkGray
        }
    } finally {
        Pop-Location
    }
}
Write-Host ""

# --- K8s: roomsync + monitoring namespaces only (NOT the whole cluster) ---
Write-Host "Checking the devops-lab kind cluster..." -ForegroundColor Cyan
$clusters = kind get clusters 2>$null
if (-not ($clusters -contains "devops-lab")) {
    Write-Host "  devops-lab cluster doesn't exist - nothing to tear down there." -ForegroundColor DarkGray
} else {
    foreach ($ns in "roomsync", "monitoring") {
        $exists = kubectl get namespace $ns --context kind-devops-lab -o name 2>$null
        if ($exists) {
            Write-Host "  Namespace '$ns' exists - deleting it..." -ForegroundColor Yellow
            kubectl delete namespace $ns --context kind-devops-lab
            Write-Host "  Done." -ForegroundColor Green
        } else {
            Write-Host "  Namespace '$ns' doesn't exist - already clean." -ForegroundColor DarkGray
        }
    }
    Write-Host ""
    Write-Host "  (The devops-lab cluster itself, and its other namespaces, are left" -ForegroundColor DarkGray
    Write-Host "   untouched - it's shared with unrelated exercises.)" -ForegroundColor DarkGray
}
Write-Host ""

Write-Host "Everything RoomSync-related is now idle." -ForegroundColor Green
Write-Host "To bring K8s back up again: scripts/dev-up-k8s.ps1" -ForegroundColor DarkGray

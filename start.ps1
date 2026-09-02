<#
.SYNOPSIS
    One-command launcher for the RoomSync Docker Compose stack (frontend, backend,
    python-service, mongo).

.DESCRIPTION
    1. Confirms Docker Desktop is actually running (not just installed).
    2. Confirms ports 3000/5000/8000/27017 are free, OR already owned by this same
       compose project's own containers (safe to reuse) - as opposed to a manual
       dev server (node/uvicorn/mongod etc.) which would conflict. Never kills
       anything automatically; just reports and stops if there's a real conflict.
    3. Runs `docker compose up --build`.
#>

$ErrorActionPreference = "Stop"

Write-Host "== RoomSync launcher ==" -ForegroundColor Cyan
Write-Host ""

# --- Step 1: Docker Desktop running? ---
Write-Host "Checking Docker Desktop..." -ForegroundColor Cyan
docker info *>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Docker Desktop does not appear to be running (or Docker isn't installed)." -ForegroundColor Red
    Write-Host "Start Docker Desktop, wait for it to fully start, then re-run this script." -ForegroundColor Red
    Write-Host ""
    exit 1
}
Write-Host "Docker Desktop is running." -ForegroundColor Green
Write-Host ""

# --- Step 2: Port conflict check ---
Write-Host "Checking ports 3000, 5000, 8000, 27017..." -ForegroundColor Cyan

# Figure out which host ports (if any) THIS compose project already owns, so we
# don't flag our own (already-running) containers from a previous `dev` as a conflict.
$ownPorts = @{}
try {
    $ourContainerIds = docker compose ps -q 2>$null
    foreach ($id in $ourContainerIds) {
        if (-not $id) { continue }
        $portsJson = docker inspect --format '{{json .NetworkSettings.Ports}}' $id 2>$null
        if (-not $portsJson) { continue }
        $portsObj = $portsJson | ConvertFrom-Json
        foreach ($prop in $portsObj.PSObject.Properties) {
            if (-not $prop.Value) { continue }
            foreach ($binding in $prop.Value) {
                if ($binding.HostPort) { $ownPorts[[int]$binding.HostPort] = $true }
            }
        }
    }
} catch {
    # No existing project containers yet - fine, $ownPorts just stays empty.
}

$targetPorts = 3000, 5000, 8000, 27017
$conflicts = @()

foreach ($p in $targetPorts) {
    $conns = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
    if (-not $conns) { continue }
    if ($ownPorts.ContainsKey($p)) {
        Write-Host "  Port $p is already in use by this project's own containers - fine, will be reused." -ForegroundColor DarkGray
        continue
    }
    foreach ($conn in $conns) {
        $ownerPid = $conn.OwningProcess
        $proc = Get-Process -Id $ownerPid -ErrorAction SilentlyContinue
        $procName = if ($proc) { $proc.ProcessName } else { "unknown" }
        $conflicts += [PSCustomObject]@{ Port = $p; PID = $ownerPid; Process = $procName }
    }
}

if ($conflicts.Count -gt 0) {
    Write-Host ""
    Write-Host "Port conflict(s) detected - the following ports are held by a process" -ForegroundColor Red
    Write-Host "that is NOT part of this Docker Compose project (likely a manually-running" -ForegroundColor Red
    Write-Host "dev server):" -ForegroundColor Red
    Write-Host ""
    $conflicts | Sort-Object Port -Unique | Format-Table -AutoSize
    Write-Host "Not stopping anything automatically - that's your call." -ForegroundColor Yellow
    Write-Host "Close the manual dev server(s) above, then re-run this script." -ForegroundColor Yellow
    Write-Host "(Or, if you just want to test alongside them, override the compose ports:" -ForegroundColor Yellow
    Write-Host '  $env:FRONTEND_PORT=3001; $env:BACKEND_PORT=5001; $env:PYTHON_PORT=8001; $env:MONGO_PORT=27018; docker compose up --build)' -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "  Ports are clear." -ForegroundColor Green
Write-Host ""

# --- Step 3: bring the stack up ---
Write-Host "Starting the stack (docker compose up --build)..." -ForegroundColor Cyan
Write-Host "First run builds images and takes longer; subsequent runs are fast." -ForegroundColor DarkGray
Write-Host ""
docker compose up --build

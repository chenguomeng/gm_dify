#Requires -Version 5.1

. "$PSScriptRoot\00_common.ps1"

Write-Host "========================================"
Write-Host "1. Start Docker Middleware"
Write-Host "========================================"

Set-Location $DIFY_DOCKER
if (-not $?) { Write-Host "ERROR: cannot find $DIFY_DOCKER" -ForegroundColor Red; pause; exit 1 }

# ---- Check Docker ----
docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker not running. Start Docker Desktop first." -ForegroundColor Red
    pause; exit 1
}

# ---- Copy env file if missing ----
if (-not (Test-Path "middleware.env")) {
    Write-Host "Copying middleware.env.example..."
    Copy-Item "envs\middleware.env.example" "middleware.env"
    if (-not $?) { Write-Host "ERROR: copy failed" -ForegroundColor Red; pause; exit 1 }
}

# ---- Write exposed ports (UTF-8 no BOM) ----
Write-Host "Setting exposed ports (PostgreSQL=$DIFY_DB_PORT, Redis=$DIFY_REDIS_PORT)..."
$p = "middleware.env"
$t = [IO.File]::ReadAllText($p, [Text.UTF8Encoding]::new($false))
$t = [Regex]::Replace($t, '(?m)^EXPOSE_POSTGRES_PORT=.*$', "EXPOSE_POSTGRES_PORT=$DIFY_DB_PORT")
$t = [Regex]::Replace($t, '(?m)^EXPOSE_REDIS_PORT=.*$',    "EXPOSE_REDIS_PORT=$DIFY_REDIS_PORT")
[IO.File]::WriteAllText($p, $t, [Text.UTF8Encoding]::new($false))

# ---- Show port conflicts ----
Write-Host ""
Write-Host "Checking port usage..."
foreach ($port in @($DIFY_DB_PORT, $DIFY_REDIS_PORT, $DIFY_WEAVIATE_PORT)) {
    $inUse = netstat -ano | Select-String "LISTENING" | Select-String ":$port "
    if ($inUse) { Write-Host "  Port $port is in use (may be existing Docker container)" }
}

# ---- Start Docker containers ----
Write-Host ""
Write-Host "Starting Docker middleware..."
docker compose --env-file middleware.env -f docker-compose.middleware.yaml -p dify up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Docker middleware startup failed." -ForegroundColor Red
    Write-Host "  If 'ports are not available': check reserved ports:"
    Write-Host "    netsh int ipv4 show excludedportrange protocol=tcp"
    Write-Host "  Then change DIFY_DB_PORT / DIFY_REDIS_PORT in 00_common.ps1."
    pause; exit 1
}

Write-Host ""
Write-Host "========================================"
Write-Host "Container status:"
docker ps --filter "name=dify" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
Write-Host "========================================"
Write-Host "Middleware ready! Next: .\02_backend_setup.ps1"
Write-Host "========================================"
Set-Location $DIFY_ROOT
pause

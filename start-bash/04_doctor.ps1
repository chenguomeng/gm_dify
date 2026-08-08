#Requires -Version 5.1

. "$PSScriptRoot\00_common.ps1"

Write-Host "========================================"
Write-Host "Environment Diagnostics"
Write-Host "========================================"

if (-not (Test-Path $VPY)) {
    Write-Host "ERROR: venv not found. Run .\02_backend_setup.ps1 first." -ForegroundColor Red
    pause; exit 1
}

Set-Location $DIFY_API

Write-Host ""
Write-Host "---- Docker Containers ----"
docker ps --filter "name=dify" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "  Docker not running" }

Write-Host ""
Write-Host "---- Port Usage ----"
foreach ($port in @($DIFY_DB_PORT, $DIFY_REDIS_PORT, $DIFY_WEAVIATE_PORT, $DIFY_API_PORT, $DIFY_WEB_PORT)) {
    $inUse = netstat -ano | Select-String "LISTENING" | Select-String ":$port "
    if ($inUse) { Write-Host "  $port  in use" } else { Write-Host "  $port  free" }
}
Write-Host "  Note: Native PostgreSQL uses 5432, Redis uses 6379."
Write-Host "        Containers remapped to $DIFY_DB_PORT / $DIFY_REDIS_PORT."

Write-Host ""
Write-Host "---- Dependencies ----"
& $VPY -c "import flask_restx,pyarrow,chromadb,psycopg2,redis,celery;print('  all key packages import OK; flask_restx',flask_restx.__version__)" 2>&1
if ($LASTEXITCODE -ne 0) { Write-Host "  Dependency check failed. Run .\02_backend_setup.ps1" }

Write-Host ""
if ($args[0] -eq "scan") {
    Write-Host "---- Full source scan (all .py files, may take minutes) ----"
    & $VPY $DIAG --env --conn --import --scan
} else {
    Write-Host "---- .env / connectivity / app import check (~15 sec) ----"
    Write-Host "     To full-scan source files: .\04_doctor.ps1 scan"
    & $VPY $DIAG --env --conn --import
}
$rc = $LASTEXITCODE

Write-Host ""
Write-Host "========================================"
if ($rc -eq 0) {
    Write-Host "All checks passed." -ForegroundColor Green
} else {
    Write-Host "Problems found - see details above." -ForegroundColor Yellow
}
Write-Host "========================================"
Set-Location $DIFY_ROOT
pause

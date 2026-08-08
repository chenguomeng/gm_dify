#Requires -Version 5.1

. "$PSScriptRoot\00_common.ps1"

Write-Host "========================================"
Write-Host "3. DB Migration + Start API and Worker"
Write-Host "========================================"

Set-Location $DIFY_API
if (-not $?) { Write-Host "ERROR: cannot find $DIFY_API" -ForegroundColor Red; pause; exit 1 }

if (-not (Test-Path $VPY)) {
    Write-Host "ERROR: venv not found. Run .\02_backend_setup.ps1 first." -ForegroundColor Red
    pause; exit 1
}

$env:DIFY_API  = $DIFY_API
$env:PYTHONUTF8 = "1"

# Dify's app.py:is_db_command() requires sys.argv[0] to END WITH "flask" to take
# the lightweight create_migrations_app() branch. On Windows neither
# `python -m flask` (argv0 = ...\flask\__main__.py) nor `flask.exe`
# (argv0 = ...\flask.exe) satisfies that, so `db upgrade` would wrongly build the
# FULL app. This shim sets argv0 to the literal "flask" before delegating.
$FLASKSHIM = "$PSScriptRoot\_flask.py"

# ============================================================
# Pre-flight: verify middleware (PostgreSQL) is reachable
# ============================================================
Write-Host ""
Write-Host "--- Pre-flight: Checking middleware services ---"

# Read DB credentials from api/.env (same values Dify itself uses)
$envFile = "$DIFY_API\.env"
$DB_HOST = "localhost"
$DB_PORT = $DIFY_DB_PORT
$DB_USER = "postgres"
$DB_PASS = "difyai123456"
$DB_NAME = "dify"
if (Test-Path $envFile) {
    Select-String -Path $envFile -Pattern '^DB_HOST=' | ForEach-Object { $DB_HOST = ($_ -split '=', 2)[1].Trim() }
    Select-String -Path $envFile -Pattern '^DB_PORT=' | ForEach-Object { $DB_PORT = ($_ -split '=', 2)[1].Trim() }
    Select-String -Path $envFile -Pattern '^DB_USERNAME=' | ForEach-Object { $DB_USER = ($_ -split '=', 2)[1].Trim() }
    Select-String -Path $envFile -Pattern '^DB_PASSWORD=' | ForEach-Object { $DB_PASS = ($_ -split '=', 2)[1].Trim() }
    Select-String -Path $envFile -Pattern '^DB_DATABASE=' | ForEach-Object { $DB_NAME = ($_ -split '=', 2)[1].Trim() }
}

# Check 1: Docker daemon running?
$dockerOk = $true
docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  WARNING: Docker not running. Middleware containers won't be available." -ForegroundColor Yellow
    $dockerOk = $false
}

# Check 2: Are the Dify Docker containers running?
if ($dockerOk) {
    $dbContainer = docker ps --filter "name=dify-db_postgres" --format "{{.Names}}" 2>$null
    if (-not $dbContainer) {
        $dbContainer = docker ps --filter "name=dify" --filter "ancestor=postgres:15-alpine" --format "{{.Names}}" 2>$null
    }
    if ($dbContainer) {
        Write-Host "  PostgreSQL container running: $dbContainer"
    } else {
        Write-Host "  WARNING: PostgreSQL container not found." -ForegroundColor Yellow
        Write-Host "           Run .\01_docker_middleware.ps1 first." -ForegroundColor Yellow
    }
}

# Check 3: Can we actually connect to PostgreSQL via TCP + psycopg2?
Write-Host "  Testing PostgreSQL connection ($DB_HOST`:$DB_PORT, user=$DB_USER, db=$DB_NAME)..."
$connTestScript = @"
import sys
try:
    import psycopg2
    conn = psycopg2.connect(
        host='$DB_HOST', port=$DB_PORT, user='$DB_USER',
        password='$DB_PASS', database='$DB_NAME', connect_timeout=5
    )
    conn.close()
    print('OK')
    sys.exit(0)
except Exception as e:
    print(str(e), file=sys.stderr)
    sys.exit(1)
"@

$dbReady = $false
$maxRetries = 6
for ($retry = 1; $retry -le $maxRetries; $retry++) {
    $result = & $VPY -B -c $connTestScript 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  PostgreSQL connection OK" -ForegroundColor Green
        $dbReady = $true
        break
    }

    $errMsg = ($result -join " ") -replace '\s+', ' '
    if ($retry -lt $maxRetries) {
        Write-Host "  [$retry/$maxRetries] PostgreSQL not ready: $errMsg" -ForegroundColor Yellow
        Write-Host "  Waiting 5s before retry..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    } else {
        Write-Host "  [$retry/$maxRetries] PostgreSQL not ready: $errMsg" -ForegroundColor Red
    }
}

if (-not $dbReady) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  PostgreSQL is NOT accessible on $DB_HOST`:$DB_PORT" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Please start the Docker middleware first:" -ForegroundColor Yellow
    Write-Host "    .\01_docker_middleware.ps1" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  If the container IS running, verify:" -ForegroundColor Yellow
    Write-Host "    - docker ps --filter `"name=dify`"" -ForegroundColor Yellow
    Write-Host "    - Port $DB_PORT is exposed in middleware.env" -ForegroundColor Yellow
    Write-Host "    - No other process is using port $DB_PORT" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Red
    pause; exit 1
}

# ---- Step 1: DB Migration ----
Write-Host ""
Write-Host "=== Step 1/3: DB Migration ==="
& $VPY -B $FLASKSHIM db upgrade
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] DB migration failed." -ForegroundColor Red
    pause; exit 1
}

# ---- Step 2: Start API server ----
# NOTE: cmd's `set VAR=value && next` swallows the space before && into the
# value, so PYTHONUTF8 becomes "1 " and Python dies with
# "preconfig_init_utf8_mode: invalid PYTHONUTF8 environment variable value".
# Always use the quoted form: set "VAR=value".
# The shim is not needed here: argv[1] is "run", not "db", so is_db_command()
# is already False and create_app() is used.
Write-Host ""
Write-Host "=== Step 2/3: Start API server (port $DIFY_API_PORT) ==="
$apiCmd = "cd /d `"$DIFY_API`" && set `"PYTHONUTF8=1`" && set `"DIFY_API=$DIFY_API`" && `".venv\Scripts\python.exe`" -m flask run --host 0.0.0.0 --port=$DIFY_API_PORT --debug"
Start-Process cmd -ArgumentList "/k", $apiCmd -WindowStyle Normal

Write-Host "Waiting for API..."
$apiReady = $false
for ($i = 1; $i -le 40; $i++) {
    if (-not $apiReady) {
        Start-Sleep -Seconds 3
        if (netstat -ano | Select-String "LISTENING" | Select-String ":$DIFY_API_PORT ") {
            $apiReady = $true
            Write-Host "  API listening on $DIFY_API_PORT"
        }
    }
}
if (-not $apiReady) { Write-Host "  WARNING: port $DIFY_API_PORT not ready." -ForegroundColor Yellow }

# ---- Step 3: Start Worker ----
Write-Host ""
Write-Host "=== Step 3/3: Start Worker ==="
$queues = "dataset,dataset_summary,priority_dataset,priority_pipeline,pipeline,mail,ops_trace,app_deletion,plugin,workflow_storage,conversation,workflow,schedule_poller,schedule_executor,triggered_workflow_dispatcher,trigger_refresh_executor,retention,workflow_based_app_execution"
$workerCmd = "cd /d `"$DIFY_API`" && set `"PYTHONUTF8=1`" && set `"DIFY_API=$DIFY_API`" && `".venv\Scripts\python.exe`" -m celery -A app.celery worker -P gevent -c 1 --loglevel INFO -Q $queues"
Start-Process cmd -ArgumentList "/k", $workerCmd -WindowStyle Normal

Write-Host ""
Write-Host "========================================"
Write-Host "API and Worker started!"
Write-Host "  API:      http://localhost:$DIFY_API_PORT"
Write-Host "Next: .\05_frontend_start.ps1"
Write-Host "========================================"
Set-Location $DIFY_ROOT
pause

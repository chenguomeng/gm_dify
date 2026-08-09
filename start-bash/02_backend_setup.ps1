#Requires -Version 5.1

. "$PSScriptRoot\00_common.ps1"

Write-Host "========================================"
Write-Host "2. Setup Backend Python Env (Python 3.12)"
Write-Host "========================================"

Set-Location $DIFY_API
if (-not $?) { Write-Host "ERROR: cannot find $DIFY_API" -ForegroundColor Red; pause; exit 1 }

# ---- Check Python 3.12 ----
py -3.12 --version 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Python 3.12 not found." -ForegroundColor Red
    Write-Host "Install from: https://www.python.org/downloads/"
    pause; exit 1
}
Write-Host "Python version:"
py -3.12 --version

# ---- Check git ----
Write-Host "Checking git..."
git --version 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: git not found, cannot fetch flask-restx source." -ForegroundColor Red
    pause; exit 1
}
Write-Host "  git OK"

# ---- Virtual env ----
Write-Host ""
Write-Host "Checking virtual environment..."
$needNew = $false

if ($args[0] -eq "rebuild") {
    Write-Host "  rebuild requested"
    $needNew = $true
}

if (-not (Test-Path $VPY)) {
    $needNew = $true
}

if (-not $needNew) {
    & $VPY -c "import sys;sys.exit(0 if sys.version_info[:2]==(3,12) else 1)" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Existing .venv is NOT Python 3.12, needs rebuild."
        $needNew = $true
    }
}

if ($needNew) {
    if (Test-Path "venv")  { Write-Host "  Removing old venv...";  Remove-Item -Recurse -Force "venv" }
    if (Test-Path ".venv") { Write-Host "  Removing old .venv..."; Remove-Item -Recurse -Force ".venv" }
    Write-Host "  Creating venv .venv (Python 3.12)..."
    py -3.12 -m venv .venv
    if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: venv creation failed" -ForegroundColor Red; pause; exit 1 }
    Write-Host "  venv created OK"
} else {
    Write-Host "  Existing .venv (Python 3.12) is OK, reusing."
}

Write-Host "Venv Python version:"
& $VPY --version
Write-Host ""

# ---- Install pip / uv ----
Write-Host "Upgrading pip..."
& $VPY -m pip install --upgrade pip --quiet
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: pip upgrade failed" -ForegroundColor Red; pause; exit 1 }

Write-Host "Installing uv..."
& $VPY -m pip install uv --quiet
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: uv install failed" -ForegroundColor Red; pause; exit 1 }

# ---- .env setup ----
if (-not (Test-Path ".env")) {
    Write-Host "Copying .env.example to .env..."
    Copy-Item .env.example .env
    if (-not $?) { Write-Host "ERROR: copy .env failed" -ForegroundColor Red; pause; exit 1 }
} else {
    Write-Host ".env exists, only updating SECRET_KEY and ports."
}

Write-Host "Writing SECRET_KEY and middleware ports (UTF-8)..."
& $VPY -c "import base64,re,secrets;p='.env';s=open(p,encoding='utf-8').read();s=re.sub(r'(?m)^SECRET_KEY=.*$','SECRET_KEY='+base64.b64encode(secrets.token_bytes(42)).decode(),s,count=1);s=re.sub(r'(?m)^DB_PORT=.*$','DB_PORT=$env:DIFY_DB_PORT',s,count=1);s=re.sub(r'(?m)^REDIS_PORT=.*$','REDIS_PORT=$env:DIFY_REDIS_PORT',s,count=1);open(p,'w',encoding='utf-8',newline='\n').write(s);open(p,'rb').read().decode('utf-8');print('  .env written, utf-8 verified')"
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: .env write failed" -ForegroundColor Red; pause; exit 1 }

# ---- Dependency sync ----
Write-Host ""
Write-Host "Syncing Python deps (skipping flask-restx and chroma-hnswlib)..."
Write-Host "  First install ~500 packages, takes 5-15 min, do not close."
& $VPY -m uv sync --dev --no-install-package flask-restx --no-install-package chroma-hnswlib --python $VPY
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: uv sync failed." -ForegroundColor Red
    pause; exit 1
}

# ---- Reinstall uv if removed during sync ----
Write-Host ""
& $VPY -m uv --version 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  uv was removed during sync, reinstalling..."
    & $VPY -m pip install uv --quiet
    if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: uv reinstall failed" -ForegroundColor Red; pause; exit 1 }
}

# ---- Install flask-restx from local clone ----
Write-Host "Fetching and installing flask-restx..."
function Install-FlaskRestx {
    if (-not (Test-Path "$FLASK_RESTX_DIR\.git")) {
        Write-Host "  cloning $FLASK_RESTX_REPO ..."
        $parent = Split-Path $FLASK_RESTX_DIR -Parent
        if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Force $parent | Out-Null }
        if (Test-Path $FLASK_RESTX_DIR) { Remove-Item -Recurse -Force $FLASK_RESTX_DIR }
        git clone --quiet $FLASK_RESTX_REPO $FLASK_RESTX_DIR
        if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: clone flask-restx failed" -ForegroundColor Red; exit 1 }
    } else {
        Write-Host "  local repo exists, updating..."
        git -C $FLASK_RESTX_DIR fetch --quiet origin
    }
    git -C $FLASK_RESTX_DIR checkout --quiet $FLASK_RESTX_REV
    if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: checkout $FLASK_RESTX_REV failed" -ForegroundColor Red; exit 1 }

    Write-Host "  installing flask-restx (pip)..."
    & $VPY -m pip install --no-cache-dir $FLASK_RESTX_DIR
    if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: flask-restx install failed" -ForegroundColor Red; exit 1 }
}
Install-FlaskRestx
if ($LASTEXITCODE -ne 0) { pause; exit 1 }

# ---- Verify ----
Write-Host ""
Write-Host "Verifying key packages..."
& $VPY -c "import flask_restx,pyarrow,chromadb,psycopg2,redis,celery,dotenv;print('  key packages OK, flask_restx',flask_restx.__version__)"
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: key package import failed." -ForegroundColor Red; pause; exit 1 }

Write-Host ""
Write-Host "Full import check..."
$valOk = $false
for ($i = 1; $i -le 3; $i++) {
    if (-not $valOk) {
        & $VPY $DIAG --env --import
        if ($LASTEXITCODE -eq 0) {
            $valOk = $true
        } else {
            Write-Host "  Attempt $i/3 failed, waiting 30s..."
            Start-Sleep -Seconds 30
        }
    }
}
if (-not $valOk) {
    Write-Host ""
    Write-Host "[WARN] Import check failed after 3 retries." -ForegroundColor Yellow
    Write-Host "  If `"null bytes`": packages ARE installed; AV returning zero-filled buffer."
    Write-Host "  Add these dirs to AV trust/whitelist:"
    Write-Host "    $DIFY_API"
    Write-Host "    $DIFY_API\.venv"
    Write-Host "  Continuing anyway..."
}

Write-Host ""
Write-Host "========================================"
Write-Host "Backend setup complete! Next: .\03_backend_start.ps1"
Write-Host "========================================"
Set-Location $DIFY_ROOT
pause

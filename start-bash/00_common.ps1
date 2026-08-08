#Requires -Version 5.1
# ==================================================
# Common Configuration for Dify Local Development
# ==================================================

# ---- Project Paths ----
$DIFY_ROOT = "D:\python\workspace\gm_dify20260718\gm_dify"
$DIFY_API = "$DIFY_ROOT\api"
$DIFY_WEB = "$DIFY_ROOT\web"
$DIFY_DOCKER = "$DIFY_ROOT\docker"

# ---- Port Configuration ----
# Middleware ports — must match EXPOSE_* values in docker\middleware.env
$DIFY_DB_PORT = 5432            # PostgreSQL (EXPOSE_POSTGRES_PORT)
$DIFY_REDIS_PORT = 6379         # Redis (EXPOSE_REDIS_PORT)
$DIFY_WEAVIATE_PORT = 8080      # Weaviate (EXPOSE_WEAVIATE_PORT)

# Application ports
$DIFY_API_PORT = 5001           # Backend API
$DIFY_WEB_PORT = 3000           # Frontend web

# ---- Python Environment ----
$VPY = "$DIFY_API\.venv\Scripts\python.exe"

# ---- Flask-Restx Configuration ----
# Must install from git source (PyPI doesn't have 1.3.3.dev0)
# Clone to local directory first to avoid uv git fetch issues on Windows
$FLASK_RESTX_REPO = "https://github.com/asukaminato0721/flask-restx"
$FLASK_RESTX_REV = "27758e26f8f740d7525d5039c51a9e524b6e2b68"
$FLASK_RESTX_DIR = "D:\python\workspace\deps\flask-restx"

# ---- Diagnostic Script Paths ----
$DIAG = "$PSScriptRoot\_diagnose.py"

# ---- uv Configuration ----
# Force copy mode for uv on Windows (avoids hardlink failures)
$env:UV_LINK_MODE = "copy"

# ---- Python UTF-8 Configuration ----
# Force Python to use UTF-8 for .env and other text files
$env:PYTHONUTF8 = "1"

# ---- Export for child processes ----
$env:DIFY_ROOT = $DIFY_ROOT
$env:DIFY_API = $DIFY_API
$env:DIFY_WEB = $DIFY_WEB
$env:DIFY_DB_PORT = $DIFY_DB_PORT
$env:DIFY_REDIS_PORT = $DIFY_REDIS_PORT
$env:DIFY_WEAVIATE_PORT = $DIFY_WEAVIATE_PORT
$env:DIFY_API_PORT = $DIFY_API_PORT
$env:DIFY_WEB_PORT = $DIFY_WEB_PORT

Write-Host "[Config Loaded] DIFY_ROOT=$DIFY_ROOT" -ForegroundColor Cyan

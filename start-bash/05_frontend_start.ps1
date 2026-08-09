#Requires -Version 5.1

. "$PSScriptRoot\00_common.ps1"

Write-Host "========================================"
Write-Host "5. Start Frontend Web (port $DIFY_WEB_PORT)"
Write-Host "========================================"

Set-Location $DIFY_ROOT
if (-not $?) { Write-Host "ERROR: cannot find $DIFY_ROOT" -ForegroundColor Red; pause; exit 1 }

# ---- Check Node ----
node --version 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Node.js not found. Project requires Node 22.x." -ForegroundColor Red
    Write-Host "Download: https://nodejs.org/"
    pause; exit 1
}
Write-Host "Node version:"
node --version

# ---- Ensure pnpm ----
function Ensure-Pnpm {
    pnpm --version 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "pnpm version:"
        pnpm --version
        return $true
    }

    Write-Host "pnpm not working, cleaning up stale state..."
    npm uninstall -g pnpm 2>&1 | Out-Null

    # Try corepack (ships with Node 16+)
    Write-Host "Trying corepack..."
    corepack enable 2>&1 | Out-Null
    pnpm --version 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "pnpm version:"
        pnpm --version
        return $true
    }

    # Fallback: npm install
    Write-Host "corepack failed, installing pnpm@11 via npm..."
    npm install -g pnpm@11 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "pnpm version:"
        pnpm --version
        return $true
    }

    Write-Host "[ERROR] Failed to install pnpm." -ForegroundColor Red
    Write-Host "  Try as admin: npm install -g pnpm@11"
    return $false
}

if (-not (Ensure-Pnpm)) { pause; exit 1 }
Write-Host ""

# ---- Frontend env file ----
if (-not (Test-Path "$DIFY_WEB\.env.local")) {
    Write-Host "Copying web\.env.example to web\.env.local..."
    Copy-Item "$DIFY_WEB\.env.example" "$DIFY_WEB\.env.local"
    if (-not $?) { Write-Host "ERROR: copy failed" -ForegroundColor Red; pause; exit 1 }
} else {
    Write-Host "web\.env.local exists, updating API URL"
}

# ---- Point frontend at local backend (UTF-8 no BOM) ----
Write-Host "Setting frontend API to localhost:$DIFY_API_PORT..."
$p = "$DIFY_WEB\.env.local"
$t = [IO.File]::ReadAllText($p, [Text.UTF8Encoding]::new($false))
$t = [Regex]::Replace($t, '(?m)^CONSOLE_API_URL=.*$',          "CONSOLE_API_URL=http://localhost:$DIFY_API_PORT")
$t = [Regex]::Replace($t, '(?m)^NEXT_PUBLIC_API_PREFIX=.*$',   "NEXT_PUBLIC_API_PREFIX=http://localhost:$DIFY_API_PORT/console/api")
$t = [Regex]::Replace($t, '(?m)^NEXT_PUBLIC_PUBLIC_API_PREFIX=.*$', "NEXT_PUBLIC_PUBLIC_API_PREFIX=http://localhost:$DIFY_API_PORT/api")
$t = [Regex]::Replace($t, '(?m)^NEXT_PUBLIC_SOCKET_URL=.*$',   "NEXT_PUBLIC_SOCKET_URL=ws://localhost:$DIFY_API_PORT")
[IO.File]::WriteAllText($p, $t, [Text.UTF8Encoding]::new($false))

# ---- Install deps ----
Write-Host ""
if (Test-Path "$DIFY_ROOT\node_modules\.pnpm") {
    Write-Host "node_modules exists, running pnpm install..."
} else {
    Write-Host "First frontend install, takes 5-15 min..."
}
Write-Host "  Working dir: $(Get-Location)"

$pnpmOk = $false
pnpm install --no-frozen-lockfile
if ($LASTEXITCODE -eq 0) {
    $pnpmOk = $true
} else {
    Write-Host "[WARN] pnpm install failed, retrying with store prune..." -ForegroundColor Yellow
    pnpm store prune
    pnpm install --no-frozen-lockfile
    if ($LASTEXITCODE -eq 0) { $pnpmOk = $true }
}
if (-not $pnpmOk) {
    Write-Host "[ERROR] pnpm install failed twice." -ForegroundColor Red
    Write-Host "  Try manually: cd $DIFY_ROOT; pnpm install"
    pause; exit 1
}
Write-Host "  pnpm install done."

# ---- Check backend ----
Write-Host ""
$apiRunning = netstat -ano | Select-String "LISTENING" | Select-String ":$DIFY_API_PORT "
if ($apiRunning) {
    Write-Host "API server on $DIFY_API_PORT is running."
} else {
    Write-Host "WARNING: API ($DIFY_API_PORT) not detected. Run .\03_backend_start.ps1 first." -ForegroundColor Yellow
}

# ---- Check frontend port ----
$webInUse = netstat -ano | Select-String "LISTENING" | Select-String ":$DIFY_WEB_PORT "
if ($webInUse) {
    Write-Host "ERROR: port $DIFY_WEB_PORT is already in use." -ForegroundColor Red
    pause; exit 1
}

# ---- Start frontend dev server ----
Write-Host ""
Write-Host "========================================"
Write-Host "Starting frontend dev server..."
Write-Host "========================================"
# NODE_OPTIONS tuning:
#   --max-old-space-size=8192 : 8 GB heap (project is large; 4 GB can GC-thrash)
#   DISABLE_CODE_INSPECTOR=1  : skip code-inspector-plugin → faster Turbopack compile
#   To re-enable code inspector (click-to-open in IDE): remove DISABLE_CODE_INSPECTOR
# Devtools (also controlled via web\.env.local → NEXT_PUBLIC_DISABLE_*):
#   NEXT_PUBLIC_DISABLE_REACT_SCAN=1   : disable react-scan (component re-render visualizer)
#   NEXT_PUBLIC_DISABLE_AGENTATION=1   : disable agentation (AI agent debugger)
# Use the quoted form `set "VAR=value"`: the unquoted form swallows the space
# before && into the value (PORT would become "3000 ").
$webCmd = "cd /d `"$DIFY_WEB`" && set `"PORT=$DIFY_WEB_PORT`" && set `"DISABLE_CODE_INSPECTOR=1`" && set `"NODE_OPTIONS=--max-old-space-size=8192`" && pnpm run dev --turbo"
Start-Process cmd -ArgumentList "/k", $webCmd -WindowStyle Normal

# ---- Wait for frontend port ----
Write-Host ""
Write-Host "Waiting for frontend build (first build takes 1-3 min)..."
$webReady = $false
for ($i = 1; $i -le 48; $i++) {
    if (-not $webReady) {
        Start-Sleep -Seconds 5
        $listening = netstat -ano | Select-String "LISTENING" | Select-String ":$DIFY_WEB_PORT "
        if ($listening) {
            $webReady = $true
            Write-Host "  Frontend listening on $DIFY_WEB_PORT"
        }
    }
}
if (-not $webReady) {
    Write-Host "  WARNING: port $DIFY_WEB_PORT not ready. Check the 'Dify Web' window." -ForegroundColor Yellow
} else {
    Start-Process "http://localhost:$DIFY_WEB_PORT"
}

Write-Host ""
Write-Host "========================================"
Write-Host "Frontend started!"
Write-Host "  Web: http://localhost:$DIFY_WEB_PORT"
Write-Host "  First visit redirects to init page (set admin account)."
Write-Host "========================================"
pause

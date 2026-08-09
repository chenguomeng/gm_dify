#Requires -Version 5.1

. "$PSScriptRoot\00_common.ps1"

Write-Host "========================================"
Write-Host "Fix: Reset Encrypt Key Pair"
Write-Host "========================================"
Write-Host ""
Write-Host "This will reset the RSA key pair used to encrypt credentials."
Write-Host "All existing model provider credentials will be cleared."
Write-Host "You will need to re-enter your API keys after this."
Write-Host ""

$confirmation = Read-Host "Type 'yes' to continue"
if ($confirmation -ne "yes") {
    Write-Host "Aborted." -ForegroundColor Yellow
    exit 0
}

Set-Location $DIFY_API
if (-not $?) {
    Write-Host "ERROR: cannot find $DIFY_API" -ForegroundColor Red
    pause
    exit 1
}

Write-Host ""
Write-Host "Running reset-encrypt-key-pair command..."
Write-Host ""

# Run the Flask command with confirmation
echo "y" | & $VPY -m flask reset-encrypt-key-pair

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================"
    Write-Host "SUCCESS!" -ForegroundColor Green
    Write-Host "========================================"
    Write-Host ""
    Write-Host "The encryption key pair has been reset."
    Write-Host "Next steps:"
    Write-Host "  1. Restart your backend server"
    Write-Host "  2. Go to Settings > Model Provider"
    Write-Host "  3. Re-enter your API keys"
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "ERROR: Command failed with exit code $LASTEXITCODE" -ForegroundColor Red
    Write-Host ""
}

Set-Location $DIFY_ROOT
pause
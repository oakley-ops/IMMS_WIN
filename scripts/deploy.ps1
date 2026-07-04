<#
Deploy the IMMS + MCS production stack at C:\imms\prod.

  deploy.ps1                  deploy latest origin/main (confirm prompt)
  deploy.ps1 -Yes             skip the confirm prompt
  deploy.ps1 -Ref deploy-20260701-0900   ROLLBACK to (or deploy) any ref/tag
  deploy.ps1 -BackupOnly      just take a pg_dump into C:\imms\backups
  deploy.ps1 -BackupOnly -EnvFile <path> backup using a specific .env's DATABASE_URL

Pipeline: preflight -> BACKUP (gate) -> checkout -> npm ci (changed roots only)
          -> migrate -> build -> pm2 reload -> health gate -> tag + push.
Any failure stops the script; prod processes keep running whatever was last
loaded until the pm2 reload step succeeds.
#>
param(
    [string]$Ref = 'origin/main',
    [switch]$Yes,
    [switch]$BackupOnly,
    [string]$EnvFile = ''
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\db-common.ps1')

$ProdRoot  = 'C:\imms\prod'
$DeployedRefFile = Join-Path $ProdRoot '.deployed-ref'
$BackupDir = 'C:\imms\backups'
$Pm2Bin    = 'C:\Users\Fiser\AppData\Roaming\npm\node_modules\pm2\bin\pm2'
$Roots     = @('backend', 'frontend', 'maintenance_call_system\backend', 'maintenance_call_system\frontend')

function Exec {
    param([string]$Command, [string]$Cwd = $ProdRoot)
    Write-Host ">> $Command" -ForegroundColor Cyan
    Push-Location $Cwd
    try {
        cmd /c $Command
        if ($LASTEXITCODE -ne 0) { throw "Command failed (exit $LASTEXITCODE): $Command" }
    } finally { Pop-Location }
}

function Wait-Healthy {
    param([string]$Url, [int]$TimeoutSec = 60)
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            if ($r.StatusCode -eq 200) { Write-Host "OK  $Url"; return }
        } catch { }
        Start-Sleep -Seconds 2
    }
    throw "Health check failed: $Url did not return 200 within $TimeoutSec s"
}

# ---- Backup (also the -BackupOnly path) -------------------------------------
if (-not $EnvFile) { $EnvFile = Join-Path $ProdRoot 'backend\.env' }
$dbUrl = Get-DatabaseUrl $EnvFile
$dump = Invoke-DbBackup -Url $dbUrl -OutDir $BackupDir -Prefix 'pre-deploy'
if ($BackupOnly) { Write-Host 'Backup-only run complete.'; exit 0 }

# ---- Preflight ---------------------------------------------------------------
if (-not (Test-Path (Join-Path $ProdRoot '.git'))) {
    throw "No production clone at $ProdRoot - run the cutover in docs/deployment/PROD_OPERATIONS.md first."
}
Exec 'git fetch origin --tags'
Write-Host "`nIncoming commits (HEAD..$Ref):" -ForegroundColor Yellow
Exec "git log --oneline HEAD..$Ref"
$prevTag = ''
Push-Location $ProdRoot
try {
    $prevTag = (& git tag --list 'deploy-*' | Sort-Object | Select-Object -Last 1)
    if ($LASTEXITCODE -ne 0) { throw "git tag --list failed (exit $LASTEXITCODE)" }
} finally { Pop-Location }

# Lockfile diffs compare against the last SUCCESSFULLY deployed ref (marker file),
# so a rollback after a failed deploy still reinstalls that deploy's dependency changes.
$baseRef = ''
if (Test-Path $DeployedRefFile) { $baseRef = (Get-Content $DeployedRefFile | Select-Object -First 1).Trim() }
if (-not $baseRef) { $baseRef = $prevTag }
if ($baseRef) {
    Push-Location $ProdRoot
    try {
        & git cat-file -e "$baseRef^{commit}"
        if ($LASTEXITCODE -ne 0) { Write-Host "Recorded base ref '$baseRef' not found - installing all roots"; $baseRef = '' }
    } finally { Pop-Location }
}
if (-not $Yes) {
    $answer = Read-Host "Deploy '$Ref' to production? Old code keeps running until the reload step. (y/N)"
    if ($answer -ne 'y') { Write-Host 'Aborted.'; exit 1 }
}

# ---- Checkout -----------------------------------------------------------------
Exec "git checkout --detach $Ref"

# ---- Install (only roots whose lockfile changed since the previous deploy) ----
foreach ($root in $Roots) {
    $needInstall = $true
    if ($baseRef) {
        $gitPath = $root -replace '\\', '/'
        Push-Location $ProdRoot
        try {
            $changed = (& git diff --name-only $baseRef HEAD -- "$gitPath/package-lock.json")
            if ($LASTEXITCODE -ne 0) { throw "git diff failed (exit $LASTEXITCODE) for $gitPath/package-lock.json" }
        } finally { Pop-Location }
        $needInstall = [bool]$changed
    }
    if ($needInstall) {
        $apiApp = ''
        if ($root -eq 'backend') { $apiApp = 'imms-api' }
        if ($root -eq 'maintenance_call_system\backend') { $apiApp = 'mcs-api' }
        if ($apiApp) {
            # Running APIs hold native modules (bcrypt/sharp) locked on Windows;
            # stop is best-effort: the app may not be registered on a first deploy.
            Write-Host "Stopping $apiApp before npm ci (native modules lock files while running)"
            Push-Location $ProdRoot
            try {
                cmd /c "node `"$Pm2Bin`" stop $apiApp"
                if ($LASTEXITCODE -ne 0) { Write-Host "$apiApp not registered in PM2 yet - continuing" }
            } finally { Pop-Location }
        }
        Exec 'npm ci' (Join-Path $ProdRoot $root)
    }
    else { Write-Host "npm ci skipped (lockfile unchanged): $root" }
}

# ---- Migrate -------------------------------------------------------------------
# IMMS migrate is an idempotent no-op on an existing DB (applies db/schema.sql once).
Exec 'npm run migrate' (Join-Path $ProdRoot 'backend')
Exec 'npm run migrate' (Join-Path $ProdRoot 'maintenance_call_system\backend')

# ---- Build ---------------------------------------------------------------------
Exec 'npm run build' (Join-Path $ProdRoot 'maintenance_call_system\frontend')
Exec 'npm run build:localhost' (Join-Path $ProdRoot 'frontend')
Exec 'npm run build:network' (Join-Path $ProdRoot 'frontend')

# ---- Reload --------------------------------------------------------------------
Exec "node `"$Pm2Bin`" startOrReload ecosystem.prod.config.js"
Exec "node `"$Pm2Bin`" save"

# ---- Health gate ----------------------------------------------------------------
try {
    Wait-Healthy 'http://localhost:4000/health'
    Wait-Healthy 'http://localhost:4001/health'
    Wait-Healthy 'http://localhost:3001/'
    Wait-Healthy 'http://localhost:3002/'
    Wait-Healthy 'http://localhost:3003/board'
} catch {
    Write-Host "`nHEALTH GATE FAILED. Pre-deploy dump: $dump" -ForegroundColor Red
    if ($prevTag) {
        Write-Host "Roll back with:  powershell -File scripts\deploy.ps1 -Ref $prevTag -Yes" -ForegroundColor Red
    }
    throw
}

# ---- Record deployed ref (for the next run's lockfile-diff base) --------------
Push-Location $ProdRoot
try {
    $deployedSha = (& git rev-parse HEAD)
    if ($LASTEXITCODE -ne 0) { throw "git rev-parse HEAD failed (exit $LASTEXITCODE)" }
} finally { Pop-Location }
Set-Content -Path $DeployedRefFile -Value $deployedSha -Encoding ascii

# ---- Tag ------------------------------------------------------------------------
$newTag = 'deploy-' + (Get-Date -Format 'yyyyMMdd-HHmm')
Exec "git tag $newTag HEAD"
Exec "git push origin $newTag"
Write-Host "`nDeployed and tagged $newTag. Previous: $(if ($prevTag) { $prevTag } else { '(first deploy)' })" -ForegroundColor Green

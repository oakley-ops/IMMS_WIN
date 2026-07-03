<#
Rebuild the DEV database (fiservinventory_dev) from the newest production dump.

  refresh-dev-db.ps1            restore newest C:\imms\backups\*.dump
  refresh-dev-db.ps1 -Fresh     take a new prod dump first, then restore it

Never touches the production database (read-only pg_dump at most).
#>
param(
    [switch]$Fresh,
    [string]$EnvFile = 'C:\imms\prod\backend\.env'
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\db-common.ps1')

$BackupDir = 'C:\imms\backups'
$DevDb = 'fiservinventory_dev'

# Before cutover the prod clone may not exist yet - fall back to the dev checkout's env.
if (-not (Test-Path $EnvFile)) {
    $EnvFile = Join-Path (Split-Path $PSScriptRoot -Parent) 'backend\.env'
    Write-Host "Prod clone env not found; using $EnvFile"
}

$dbUrl = Get-DatabaseUrl $EnvFile
$sourceDb = Set-PgEnvFromUrl $dbUrl   # sets PGHOST/PGPORT/PGUSER/PGPASSWORD
if ($sourceDb -eq $DevDb) { throw "Refusing: $EnvFile points DATABASE_URL at $DevDb itself." }

if ($Fresh) { Invoke-DbBackup -Url $dbUrl -OutDir $BackupDir -Prefix 'manual' | Out-Null }

$dump = Get-ChildItem (Join-Path $BackupDir '*.dump') -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime | Select-Object -Last 1
if (-not $dump) { throw "No dumps in $BackupDir - run scripts\deploy.ps1 -BackupOnly first (or use -Fresh)." }
Write-Host "Restoring $($dump.Name) -> $DevDb"

& (Join-Path $script:PgBin 'dropdb.exe') --if-exists --force $DevDb
if ($LASTEXITCODE -ne 0) { throw "dropdb failed (exit $LASTEXITCODE)" }
& (Join-Path $script:PgBin 'createdb.exe') $DevDb
if ($LASTEXITCODE -ne 0) { throw "createdb failed (exit $LASTEXITCODE)" }

# pg_restore exits 1 on ignorable warnings (extensions, ownership) - verify by query instead.
& (Join-Path $script:PgBin 'pg_restore.exe') --no-owner --no-privileges -d $DevDb $dump.FullName
$restoreCode = $LASTEXITCODE

$parts = & (Join-Path $script:PgBin 'psql.exe') -d $DevDb -tAc 'SELECT COUNT(*) FROM parts'
if ($LASTEXITCODE -ne 0 -or -not $parts) {
    throw "Restore verification failed (pg_restore exit $restoreCode; parts query failed)."
}
Write-Host "OK: $DevDb rebuilt from $($dump.Name) - parts rows: $($parts.Trim()) (pg_restore exit $restoreCode; nonzero = warnings only)" -ForegroundColor Green

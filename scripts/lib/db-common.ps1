# Shared DB helpers for deploy.ps1 / refresh-dev-db.ps1 (Windows PowerShell 5.1).
Set-StrictMode -Version 2.0

$script:PgBin = 'C:\Program Files\PostgreSQL\17\bin'

function Get-DatabaseUrl {
    param([Parameter(Mandatory = $true)][string]$EnvFile)
    if (-not (Test-Path $EnvFile)) { throw "Env file not found: $EnvFile" }
    # Get-Content auto-detects UTF-16 BOM files (frontend/.env is one).
    $line = Get-Content $EnvFile | Where-Object { $_ -match '^\s*DATABASE_URL=' } | Select-Object -First 1
    if (-not $line) { throw "DATABASE_URL not found in $EnvFile" }
    return ($line -replace '^\s*DATABASE_URL=', '').Trim()
}

function Set-PgEnvFromUrl {
    # Parses postgres://user:pass@host:port/dbname into PG* env vars for the CLI
    # tools and returns the database name.
    param([Parameter(Mandatory = $true)][string]$Url)
    if ($Url -notmatch '^postgres(ql)?://([^:/@]+)(:([^@]*))?@([^:/@]+)(:(\d+))?/([^?\s]+)') {
        throw "Unparseable DATABASE_URL (expected postgres://user:pass@host:port/db)"
    }
    $env:PGUSER     = [uri]::UnescapeDataString($Matches[2])
    if ($Matches[4]) { $env:PGPASSWORD = [uri]::UnescapeDataString($Matches[4]) }
    $env:PGHOST     = $Matches[5]
    if ($Matches[7]) { $env:PGPORT = $Matches[7] } else { $env:PGPORT = '5432' }
    return $Matches[8]
}

function Invoke-DbBackup {
    # pg_dump -Fc of the database in $Url into $OutDir; prunes to newest 30 dumps.
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [Parameter(Mandatory = $true)][string]$OutDir,
        [string]$Prefix = 'backup'
    )
    if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Force $OutDir | Out-Null }
    $dbName = Set-PgEnvFromUrl $Url
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $file = Join-Path $OutDir "$Prefix-$dbName-$stamp.dump"
    & (Join-Path $script:PgBin 'pg_dump.exe') -Fc -d $dbName -f $file
    if ($LASTEXITCODE -ne 0) { throw "pg_dump failed (exit $LASTEXITCODE) for $dbName" }
    Get-ChildItem (Join-Path $OutDir '*.dump') |
        Sort-Object LastWriteTime -Descending |
        Select-Object -Skip 30 |
        Remove-Item -Force -Confirm:$false
    Write-Host "Backup written: $file"
    return $file
}

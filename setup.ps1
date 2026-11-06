#Requires -Version 5.1
<#
.SYNOPSIS
    Builds and starts the Online Store (Laravel API + React + MySQL) in Docker.

.DESCRIPTION
    - checks that Docker / Docker Compose are available,
    - picks free host ports (if a preferred port is taken, the next free one is used;
      nothing that is already running gets stopped - except this project's own containers),
    - generates the root .env file (APP_KEY, DB passwords) on first run and reuses it later,
    - builds the images, starts the stack and waits until the shop responds.

    Re-run the script at any time to rebuild/redeploy.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\setup.ps1

.EXAMPLE
    .\setup.ps1 -AppPort 3000
#>
[CmdletBinding()]
param(
    [int]$AppPort = 8080,
    [int]$BackendPort = 8000,
    [int]$DbPort = 3306,
    [switch]$NoBuild
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$EnvFile = Join-Path $PSScriptRoot '.env'
$ProjectName = 'online-store'

function Write-Step([string]$Message) { Write-Host "==> $Message" -ForegroundColor Cyan }
function Write-Warn([string]$Message) { Write-Host "WARNING: $Message" -ForegroundColor Yellow }

# Runs a native command without PowerShell 5.1 turning its stderr output into terminating errors.
function Invoke-Native([scriptblock]$Command) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & $Command } finally { $ErrorActionPreference = $previous }
}

function Test-PortFree([int]$Port) {
    try {
        $listening = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
        if ($listening) { return $false }
    } catch { }

    foreach ($address in @([System.Net.IPAddress]::Any, [System.Net.IPAddress]::Loopback)) {
        $listener = New-Object System.Net.Sockets.TcpListener($address, $Port)
        try {
            $listener.Start()
        } catch {
            return $false
        } finally {
            try { $listener.Stop() } catch { }
        }
    }
    return $true
}

function Find-FreePort([int]$Preferred, [int[]]$Exclude = @()) {
    for ($port = $Preferred; $port -le [Math]::Min($Preferred + 200, 65535); $port++) {
        if ($Exclude -contains $port) { continue }
        if (Test-PortFree $port) { return $port }
    }
    throw "No free port found in range $Preferred-$($Preferred + 200)."
}

function Read-EnvFile([string]$Path) {
    $values = @{}
    if (Test-Path -LiteralPath $Path) {
        foreach ($line in Get-Content -LiteralPath $Path) {
            if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
                $values[$Matches[1]] = $Matches[2].Trim().Trim('"')
            }
        }
    }
    return $values
}

function New-RandomString([int]$Length = 24) {
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'.ToCharArray()
    $bytes = New-Object byte[] $Length
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}

function New-AppKey {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return 'base64:' + [Convert]::ToBase64String($bytes)
}

# --- 1. Docker checks -------------------------------------------------------
Write-Step 'Checking Docker...'
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker is not installed. Install Docker Desktop: https://www.docker.com/products/docker-desktop/'
}
$null = Invoke-Native { docker info 2>$null }
if ($LASTEXITCODE -ne 0) { throw 'Docker is installed but not running. Start Docker Desktop and try again.' }
$null = Invoke-Native { docker compose version 2>$null }
if ($LASTEXITCODE -ne 0) { throw "'docker compose' (v2) is not available. Update Docker Desktop." }

# --- 2. Stop this project's containers (so their own ports are not seen as taken)
Write-Step "Stopping previous '$ProjectName' containers (if any)..."
Invoke-Native { docker compose down --remove-orphans 2>&1 | Out-Null }

# --- 3. Configuration / secrets -------------------------------------------
$existing = Read-EnvFile $EnvFile
$defaults = Read-EnvFile (Join-Path $PSScriptRoot '.env.docker.example')

$null = Invoke-Native { docker volume inspect "${ProjectName}_db_data" 2>$null }
$dbVolumeExists = ($LASTEXITCODE -eq 0)

function Get-Setting([string]$Name, [scriptblock]$Generate) {
    if ($existing.ContainsKey($Name) -and $existing[$Name]) { return $existing[$Name] }
    return & $Generate
}

$appKey = Get-Setting 'APP_KEY' { New-AppKey }
$dbName = Get-Setting 'DB_DATABASE' { $defaults['DB_DATABASE'] }
$dbUser = Get-Setting 'DB_USERNAME' { $defaults['DB_USERNAME'] }
if ($dbVolumeExists -and -not $existing.ContainsKey('DB_PASSWORD')) {
    # Database volume was created earlier with the default credentials - keep them.
    $dbPassword = $defaults['DB_PASSWORD']
    $dbRootPassword = $defaults['DB_ROOT_PASSWORD']
} else {
    $dbPassword = Get-Setting 'DB_PASSWORD' { New-RandomString }
    $dbRootPassword = Get-Setting 'DB_ROOT_PASSWORD' { New-RandomString }
}
$dockerSubnet = Get-Setting 'DOCKER_SUBNET' { $defaults['DOCKER_SUBNET'] }
$frontendIp = Get-Setting 'FRONTEND_IP' { $defaults['FRONTEND_IP'] }
$appDebug = Get-Setting 'APP_DEBUG' { $defaults['APP_DEBUG'] }

# --- 4. Free ports ----------------------------------------------------------
Write-Step 'Looking for free ports...'
$appPortFree = Find-FreePort $AppPort
$backendPortFree = Find-FreePort $BackendPort @($appPortFree)
$dbPortFree = Find-FreePort $DbPort @($appPortFree, $backendPortFree)

foreach ($p in @(
        @{ Name = 'Shop (frontend)'; Wanted = $AppPort; Got = $appPortFree },
        @{ Name = 'API (backend)'; Wanted = $BackendPort; Got = $backendPortFree },
        @{ Name = 'MySQL'; Wanted = $DbPort; Got = $dbPortFree })) {
    if ($p.Wanted -ne $p.Got) {
        Write-Host ("    {0}: port {1} is busy -> using {2}" -f $p.Name, $p.Wanted, $p.Got) -ForegroundColor Yellow
    } else {
        Write-Host ("    {0}: port {1}" -f $p.Name, $p.Got)
    }
}

# --- 5. Write .env ----------------------------------------------------------
$envContent = @"
# Generated by setup.ps1 - safe to edit, re-run the setup script to apply.
APP_PORT=$appPortFree
BACKEND_PORT=$backendPortFree
DB_FORWARD_PORT=$dbPortFree

DOCKER_SUBNET=$dockerSubnet
FRONTEND_IP=$frontendIp

APP_KEY=$appKey
APP_DEBUG=$appDebug

DB_DATABASE=$dbName
DB_USERNAME=$dbUser
DB_PASSWORD=$dbPassword
DB_ROOT_PASSWORD=$dbRootPassword
"@
[System.IO.File]::WriteAllText($EnvFile, ($envContent -replace "`r`n", "`n") + "`n", (New-Object System.Text.UTF8Encoding($false)))
Write-Step 'Saved configuration to .env'

# --- 6. Build & start -------------------------------------------------------
$upArgs = @('compose', 'up', '-d')
if (-not $NoBuild) { $upArgs += '--build' }
Write-Step "Starting containers (docker $($upArgs -join ' '))... first run can take a few minutes."
Invoke-Native { & docker @upArgs }
if ($LASTEXITCODE -ne 0) {
    Write-Warn 'docker compose up failed. Recent backend logs:'
    Invoke-Native { docker compose logs --tail 50 backend }
    exit 1
}

# --- 7. Wait for the shop ---------------------------------------------------
$shopUrl = "http://localhost:$appPortFree"
Write-Step "Waiting for $shopUrl ..."
$ready = $false
$deadline = (Get-Date).AddMinutes(5)
while ((Get-Date) -lt $deadline) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 "$shopUrl/api/categories"
        if ($response.StatusCode -eq 200) { $ready = $true; break }
    } catch { }
    Start-Sleep -Seconds 3
}

if (-not $ready) {
    Write-Warn 'The shop did not respond within 5 minutes. Check: docker compose logs -f backend'
    exit 1
}

Write-Host ''
Write-Host 'Online Store is up and running!' -ForegroundColor Green
Write-Host "  Shop:   $shopUrl"
Write-Host "  API:    http://127.0.0.1:$backendPortFree/api/products"
Write-Host "  MySQL:  127.0.0.1:$dbPortFree  (db: $dbName, user: $dbUser, password in .env)"
Write-Host ''
Write-Host 'Useful commands:'
Write-Host '  docker compose logs -f      # follow logs'
Write-Host '  docker compose down         # stop'
Write-Host '  docker compose down -v      # stop and delete the database'

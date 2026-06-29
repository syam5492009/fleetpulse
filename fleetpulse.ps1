#Requires -Version 5.1
<#
.SYNOPSIS
    FleetPulse development orchestrator.

.DESCRIPTION
    start    - Start Docker infra then open Backend, Frontend and Simulator
               each in their own labeled console window.
    stop     - Kill all tracked app processes and shut down Docker.
    restart  - stop then start.
    status   - Print a live port-availability table for every service.

.EXAMPLE
    .\fleetpulse.ps1 start
    .\fleetpulse.ps1 stop
    .\fleetpulse.ps1 restart
    .\fleetpulse.ps1 status
#>

param(
    [Parameter(Position = 0)]
    [ValidateSet('start','stop','restart','status')]
    [string]$Command = 'start'
)

$ErrorActionPreference = 'Continue'

$Root    = $PSScriptRoot
$PidFile = Join-Path $Root '.fleetpulse.pids'

# ---------------------------------------------------------------------------
# Ensure Docker CLI is on PATH (Docker Desktop does not always register it)
# ---------------------------------------------------------------------------
$DockerBin = 'C:\Program Files\Docker\Docker\resources\bin'
if ((Test-Path $DockerBin) -and ($env:PATH -notlike "*$DockerBin*")) {
    $env:PATH = $DockerBin + ';' + $env:PATH
}

function Assert-DockerRunning {
    # Try a fast ping first
    $null = docker info 2>$null
    if ($LASTEXITCODE -eq 0) { return }

    Write-Step "Docker Desktop is not running -- starting it ..."
    $desktop = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
    if (-not (Test-Path $desktop)) {
        Write-Warn "Docker Desktop not found at: $desktop"
        Write-Warn "Please start Docker Desktop manually, then re-run this script."
        exit 1
    }

    Start-Process $desktop
    Write-Host "  Waiting for Docker engine" -NoNewline -ForegroundColor DarkGray
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    do {
        Start-Sleep -Seconds 4
        Write-Host '.' -NoNewline -ForegroundColor DarkGray
        $null = docker info 2>$null
    } while ($LASTEXITCODE -ne 0 -and $sw.Elapsed.TotalSeconds -lt 120)
    Write-Host ""

    if ($LASTEXITCODE -ne 0) {
        Write-Warn "Docker engine did not become ready within 120s. Please start Docker Desktop and try again."
        exit 1
    }
    Write-Ok "Docker engine ready"
}

# ---------------------------------------------------------------------------
# Console helpers  (ASCII only - no Unicode box chars)
# ---------------------------------------------------------------------------

function Write-Step   ([string]$Msg) { Write-Host "  -> $Msg"  -ForegroundColor Cyan   }
function Write-Ok     ([string]$Msg) { Write-Host "  OK $Msg"  -ForegroundColor Green  }
function Write-Warn   ([string]$Msg) { Write-Host "  !! $Msg"  -ForegroundColor Yellow }
function Write-Section([string]$Msg) { Write-Host "`n  [$Msg]" -ForegroundColor White  }

function Write-Header {
    Write-Host ""
    Write-Host "  +--------------------------------------+" -ForegroundColor DarkCyan
    Write-Host "  |      FleetPulse  Controller         |" -ForegroundColor DarkCyan
    Write-Host "  +--------------------------------------+" -ForegroundColor DarkCyan
    Write-Host ""
}

# ---------------------------------------------------------------------------
# Port probe
# ---------------------------------------------------------------------------

function Test-Port ([int]$Port) {
    try {
        $tcp   = New-Object System.Net.Sockets.TcpClient
        $async = $tcp.BeginConnect('127.0.0.1', $Port, $null, $null)
        $ok    = $async.AsyncWaitHandle.WaitOne(500, $false)
        $tcp.Close()
        return $ok
    } catch {
        return $false
    }
}

function Wait-ForPort ([int]$Port, [string]$Name, [int]$TimeoutSec = 90) {
    Write-Step "Waiting for $Name on :$Port ..."
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while (-not (Test-Port $Port)) {
        if ($sw.Elapsed.TotalSeconds -ge $TimeoutSec) {
            Write-Warn "$Name not ready after ${TimeoutSec}s -- continuing anyway"
            return
        }
        Start-Sleep -Seconds 2
        Write-Host '.' -NoNewline -ForegroundColor DarkGray
    }
    Write-Host ""
    Write-Ok "$Name ready  (port $Port)"
}

# ---------------------------------------------------------------------------
# Process-tree killer
# ---------------------------------------------------------------------------

function Remove-ProcessTree ([int]$Id) {
    $children = @(
        Get-CimInstance Win32_Process -Filter "ParentProcessId=$Id" -ErrorAction SilentlyContinue
    )
    foreach ($c in $children) { Remove-ProcessTree $c.ProcessId }
    Stop-Process -Id $Id -Force -ErrorAction SilentlyContinue
}

# ---------------------------------------------------------------------------
# Open a labeled service window
# ---------------------------------------------------------------------------

function Open-Window ([string]$Title, [string]$PnpmScript) {
    # Build the child-PS command using only single-quote concatenation to avoid
    # escape issues between the calling and child PowerShell instances.
    $block = '$host.UI.RawUI.WindowTitle = ''' + $Title + '''; ' +
             'Set-Location ''' + $Root + '''; ' +
             $PnpmScript + '; ' +
             'Write-Host ""; ' +
             'Write-Host "=== Process exited ===" -ForegroundColor Red; ' +
             'Read-Host "Press Enter to close"'

    $proc = Start-Process powershell.exe `
                -ArgumentList '-NoExit', '-Command', $block `
                -PassThru `
                -WindowStyle Normal

    return $proc
}

# ---------------------------------------------------------------------------
# START
# ---------------------------------------------------------------------------

function Start-FleetPulse {
    Write-Header

    # Guard: warn if a previous session is still alive
    if (Test-Path $PidFile) {
        $alive = @(Get-Content $PidFile) | Where-Object {
            $id = $_
            try { $null = Get-Process -Id ([int]$id) -ErrorAction Stop; $true }
            catch { $false }
        }
        if ($alive.Count -gt 0) {
            Write-Warn "FleetPulse is already running (PIDs: $($alive -join ', '))."
            Write-Warn "Run  .\fleetpulse.ps1 stop  first, or  .\fleetpulse.ps1 restart."
            return
        }
        Remove-Item $PidFile -Force
    }

    # 1. Docker infrastructure ---------------------------------------------------
    Write-Section "1/4  Docker Infrastructure"
    Assert-DockerRunning
    Write-Step "Starting Mosquitto, PostgreSQL/PostGIS, Redis ..."

    $dockerOut = docker compose up mosquitto postgres redis --detach --wait 2>&1
    $dockerOut | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }

    if ($LASTEXITCODE -ne 0) {
        Write-Warn "docker compose returned exit code $LASTEXITCODE."
        Write-Warn "Make sure Docker Desktop is running and try again."
        return
    }
    Write-Ok "Infrastructure is healthy"

    # 2. Backend -----------------------------------------------------------------
    Write-Section "2/4  Backend  (NestJS + PostGIS migration)"
    $beProc = Open-Window 'FleetPulse  BACKEND' 'pnpm dev:backend'
    Write-Ok "Backend window opened  (PID $($beProc.Id))"
    Wait-ForPort 3001 'Backend API'

    # 3. Frontend ----------------------------------------------------------------
    Write-Section "3/4  Frontend  (Next.js + Turbopack)"
    $feProc = Open-Window 'FleetPulse  FRONTEND' 'pnpm dev:frontend'
    Write-Ok "Frontend window opened  (PID $($feProc.Id))"
    Wait-ForPort 3000 'Frontend'

    # 4. Simulator ---------------------------------------------------------------
    Write-Section "4/4  Vehicle Simulator"
    $simProc = Open-Window 'FleetPulse  SIMULATOR' 'pnpm dev:simulator'
    Write-Ok "Simulator window opened  (PID $($simProc.Id))"

    # Persist PIDs so stop can find them
    @($beProc.Id, $feProc.Id, $simProc.Id) | Set-Content $PidFile -Encoding UTF8

    Write-Host ""
    Write-Host "  +------------------------------------------------+" -ForegroundColor Green
    Write-Host "  |       FleetPulse is up and running!            |" -ForegroundColor Green
    Write-Host "  +------------------------------------------------+" -ForegroundColor Green
    Write-Host "  |  Dashboard   ->  http://localhost:3000         |" -ForegroundColor Green
    Write-Host "  |  Backend API ->  http://localhost:3001         |" -ForegroundColor Green
    Write-Host "  |  Route API   ->  /vehicles/:id/route          |" -ForegroundColor Green
    Write-Host "  +------------------------------------------------+" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Three console windows opened (one per service)." -ForegroundColor Gray
    Write-Host "  Run  .\fleetpulse.ps1 stop  to shut everything down." -ForegroundColor Gray
    Write-Host ""
}

# ---------------------------------------------------------------------------
# STOP
# ---------------------------------------------------------------------------

function Stop-FleetPulse {
    Write-Header
    Write-Section "Stopping FleetPulse"

    # Kill tracked app processes (PowerShell windows + their Node.js children)
    if (Test-Path $PidFile) {
        $storedPids = @(Get-Content $PidFile) | Where-Object { $_ -match '^\d+$' }
        if ($storedPids.Count -gt 0) {
            Write-Step "Killing PIDs $($storedPids -join ', ') and their children ..."
            foreach ($id in $storedPids) { Remove-ProcessTree ([int]$id) }
        }
        Remove-Item $PidFile -Force
        Write-Ok "App processes terminated"
    } else {
        Write-Warn "No PID file found -- app processes may have already exited"
    }

    # Safety net: kill anything still holding the app ports (Node.js orphans)
    Write-Step "Releasing ports 3000 / 3001 / 5555 ..."
    foreach ($appPort in @(3000, 3001, 5555)) {
        $conn = Get-NetTCPConnection -LocalPort $appPort -State Listen -ErrorAction SilentlyContinue
        if ($conn) {
            $procId = $conn.OwningProcess
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            Write-Host "    killed PID $procId on :$appPort" -ForegroundColor DarkGray
        }
    }
    Start-Sleep -Seconds 1

    # Stop Docker services
    Write-Step "Stopping Docker services ..."
    $null = docker info 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "Docker is not running -- skipping docker compose down"
    } else {
        $dockerOut = docker compose down 2>&1
        $dockerOut | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
    }
    Write-Ok "Infrastructure stopped"

    Write-Host ""
    Write-Ok "FleetPulse fully stopped."
    Write-Host ""
}

# ---------------------------------------------------------------------------
# STATUS
# ---------------------------------------------------------------------------

function Get-FleetPulseStatus {
    Write-Header
    Write-Host "  Service                         Port    State"   -ForegroundColor White
    Write-Host "  -------------------------------------------" -ForegroundColor DarkGray

    $services = @(
        [PSCustomObject]@{ Name = 'MQTT  (Mosquitto)';      Port = 1883 },
        [PSCustomObject]@{ Name = 'PostgreSQL / PostGIS';    Port = 5432 },
        [PSCustomObject]@{ Name = 'Redis';                  Port = 6379 },
        [PSCustomObject]@{ Name = 'Backend API  (NestJS)';  Port = 3001 },
        [PSCustomObject]@{ Name = 'Frontend  (Next.js)';    Port = 3000 }
    )

    foreach ($svc in $services) {
        $up    = Test-Port $svc.Port
        $dot   = if ($up) { '[+]' } else { '[ ]' }
        $color = if ($up) { 'Green' } else { 'DarkGray' }
        $state = if ($up) { 'RUNNING' } else { 'stopped' }
        $line  = '  {0}  {1,-30}  {2,-6}  {3}' -f $dot, $svc.Name, $svc.Port, $state
        Write-Host $line -ForegroundColor $color
    }

    Write-Host ""
    if (Test-Path $PidFile) {
        $savedPids = (Get-Content $PidFile) -join ', '
        Write-Host "  Tracked PIDs : $savedPids" -ForegroundColor DarkGray
    } else {
        Write-Host "  No PID file found." -ForegroundColor DarkGray
    }
    Write-Host ""
}

# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------

switch ($Command) {
    'start'   { Start-FleetPulse }
    'stop'    { Stop-FleetPulse }
    'restart' { Stop-FleetPulse; Start-Sleep -Seconds 2; Start-FleetPulse }
    'status'  { Get-FleetPulseStatus }
}

param(
    [ValidateSet("Start", "Stop", "Status")]
    [string]$Action = "Start",
    [switch]$NoPause,
    [switch]$NoBrowser,
    [switch]$KeepAlive
)

$ErrorActionPreference = "Stop"

# Resolve paths safely (handles spaces and special characters in paths)
$ScriptDir     = Split-Path -Parent $MyInvocation.MyCommand.Definition
$AppRoot       = (Resolve-Path (Join-Path $ScriptDir "..")).Path
$WorkspaceRoot = (Resolve-Path (Join-Path $AppRoot "..")).Path
$FrontendCandidates = @(
    (Join-Path $WorkspaceRoot "Frontend_"),
    (Join-Path $AppRoot "Frontend_")
)
$FrontendDir = $FrontendCandidates | Where-Object { Test-Path (Join-Path $_ "package.json") } | Select-Object -First 1
if ([string]::IsNullOrWhiteSpace($FrontendDir)) {
    $FrontendDir = Join-Path $AppRoot "Frontend_"
}
$RunnerPy      = Join-Path $ScriptDir "launch_service_window.py"
$PreflightPy   = Join-Path $ScriptDir "preflight_check.py"
$RuntimeDir    = Join-Path $WorkspaceRoot ".astera_runtime"
$LogsDir       = Join-Path $RuntimeDir "logs"
$StateFile     = Join-Path $RuntimeDir "launcher_state.json"

$BackendHost   = "127.0.0.1"
$BackendPort   = 8000
$FrontendHost  = "127.0.0.1"
$FrontendPort  = 5173

if (-not (Test-Path $RuntimeDir)) { New-Item -ItemType Directory -Path $RuntimeDir -Force | Out-Null }
if (-not (Test-Path $LogsDir))    { New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null }

$StartupLog = Join-Path $LogsDir "launcher.log"

function Write-LauncherLog {
    param(
        [string]$Message,
        [ValidateSet("INFO", "OK", "WARN", "ERROR")]
        [string]$Level = "INFO"
    )
    $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $line = "[$ts] [$Level] $Message"
    Add-Content -Path $StartupLog -Value $line -Encoding UTF8
    switch ($Level) {
        "OK"    { Write-Host $line -ForegroundColor Green }
        "WARN"  { Write-Host $line -ForegroundColor Yellow }
        "ERROR" { Write-Host $line -ForegroundColor Red }
        default { Write-Host $line -ForegroundColor Cyan }
    }
}

function Get-PortOwnerPid {
    param([int]$Port)
    try {
        $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($null -ne $conn -and $conn.OwningProcess -gt 0) {
            return [int]$conn.OwningProcess
        }
    } catch {}
    return $null
}

function Get-ProcessCommandLine {
    param([int]$PidValue)
    try {
        $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $PidValue" -ErrorAction SilentlyContinue
        if ($null -ne $proc) {
            return [string]$proc.CommandLine
        }
    } catch {}
    return ""
}

function Test-IsAsteraProcess {
    param([int]$PidValue)
    if ($PidValue -le 0) { return $false }
    $cmd = Get-ProcessCommandLine -PidValue $PidValue
    if ([string]::IsNullOrWhiteSpace($cmd)) { return $false }
    if (
        $cmd -match "launch_service_window\.py" -or
        $cmd -match "backend\.app\.main:app" -or
        $cmd -match "astera-wildfire-platform" -or
        $cmd -match "Frontend_"
    ) {
        return $true
    }
    return $false
}

function Stop-ProcessTreeSafe {
    param([int]$RootPid, [string]$Label)
    if ($RootPid -le 0) { return $false }
    try {
        $proc = Get-Process -Id $RootPid -ErrorAction SilentlyContinue
        if ($null -ne $proc) {
            Write-LauncherLog "Stopping $Label process tree (PID $RootPid)..." "INFO"
            $prevEap = $ErrorActionPreference
            $ErrorActionPreference = "Continue"
            try {
                & taskkill.exe /PID $RootPid /T /F 2>&1 | Out-Null
            } finally {
                $ErrorActionPreference = $prevEap
            }
            Write-LauncherLog "Stopped $Label (PID $RootPid)." "OK"
            return $true
        }
    } catch {
        Write-LauncherLog "Notice while stopping $Label (PID $RootPid): $($_.Exception.Message)" "WARN"
    }
    return $false
}

function Invoke-StopLauncher {
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host "   NASA ASTERA WATCH - SAFE SERVICE SHUTDOWN (STOP.bat)               " -ForegroundColor Cyan
    Write-Host "======================================================================" -ForegroundColor Cyan

    $stoppedCount = 0

    if (Test-Path $StateFile) {
        try {
            $state = Get-Content -Path $StateFile -Raw -Encoding UTF8 | ConvertFrom-Json
            foreach ($entry in @(
                @{ Name = "FastAPI Backend"; WindowPid = $state.backend_window_pid; ListenPid = $state.backend_pid },
                @{ Name = "Vite Frontend";   WindowPid = $state.frontend_window_pid; ListenPid = $state.frontend_pid }
            )) {
                $didStop = $false
                if ($null -ne $entry.WindowPid -and [int]$entry.WindowPid -gt 0) {
                    if (Stop-ProcessTreeSafe -RootPid ([int]$entry.WindowPid) -Label "$($entry.Name) terminal") {
                        $stoppedCount++
                        $didStop = $true
                    }
                }
                if ($null -ne $entry.ListenPid -and [int]$entry.ListenPid -gt 0 -and ([int]$entry.ListenPid -ne [int]$entry.WindowPid)) {
                    if (Stop-ProcessTreeSafe -RootPid ([int]$entry.ListenPid) -Label "$($entry.Name) listener") {
                        if (-not $didStop) { $stoppedCount++ }
                    }
                }
            }
        } catch {
            Write-LauncherLog "Could not parse launcher_state.json: $($_.Exception.Message)" "WARN"
        }
    } else {
        Write-LauncherLog "No active launcher_state.json found; inspecting Astera service ports $BackendPort and $FrontendPort..." "INFO"
    }

    # Verify ports are released; only stop remaining Astera-owned listeners
    foreach ($portInfo in @(
        @{ Port = $BackendPort; Name = "Backend Port $BackendPort" },
        @{ Port = $FrontendPort; Name = "Frontend Port $FrontendPort" }
    )) {
        $ownerPid = Get-PortOwnerPid -Port $portInfo.Port
        if ($null -ne $ownerPid) {
            if (Test-IsAsteraProcess -PidValue $ownerPid) {
                if (Stop-ProcessTreeSafe -RootPid $ownerPid -Label "$($portInfo.Name) Astera listener") {
                    $stoppedCount++
                }
            } else {
                Write-LauncherLog "Port $($portInfo.Port) is held by non-Astera PID $ownerPid - leaving untouched for safety." "WARN"
            }
        }
    }

    Start-Sleep -Milliseconds 600

    $bAfter = Get-PortOwnerPid -Port $BackendPort
    $fAfter = Get-PortOwnerPid -Port $FrontendPort
    if ($null -eq $bAfter) {
        Write-LauncherLog "Port $BackendPort (FastAPI) is free." "OK"
    } else {
        Write-LauncherLog "Port $BackendPort is still occupied by PID $bAfter." "WARN"
    }
    if ($null -eq $fAfter) {
        Write-LauncherLog "Port $FrontendPort (Vite) is free." "OK"
    } else {
        Write-LauncherLog "Port $FrontendPort is still occupied by PID $fAfter." "WARN"
    }

    if (Test-Path $StateFile) {
        Remove-Item -Path $StateFile -Force -ErrorAction SilentlyContinue
    }

    Write-LauncherLog "Shutdown complete. ($stoppedCount launcher process tree(s) terminated; unrelated processes, datasets, models, and checkpoints untouched)." "OK"
}

function Find-PythonInterpreter {
    $venvCandidates = @(
        @{ Py = (Join-Path $AppRoot ".venv\Scripts\python.exe");       Root = (Join-Path $AppRoot ".venv");       Kind = "Project .venv" },
        @{ Py = (Join-Path $AppRoot "venv\Scripts\python.exe");        Root = (Join-Path $AppRoot "venv");        Kind = "Project venv" },
        @{ Py = (Join-Path $WorkspaceRoot ".venv\Scripts\python.exe"); Root = (Join-Path $WorkspaceRoot ".venv"); Kind = "Workspace .venv" },
        @{ Py = (Join-Path $WorkspaceRoot "venv\Scripts\python.exe");  Root = (Join-Path $WorkspaceRoot "venv");  Kind = "Workspace venv" },
        @{ Py = (Join-Path $env:USERPROFILE "miniconda3\envs\astera\python.exe"); Root = (Join-Path $env:USERPROFILE "miniconda3\envs\astera"); Kind = "Conda env 'astera'" },
        @{ Py = (Join-Path $env:USERPROFILE "anaconda3\envs\astera\python.exe");  Root = (Join-Path $env:USERPROFILE "anaconda3\envs\astera");  Kind = "Conda env 'astera'" }
    )
    foreach ($cand in $venvCandidates) {
        if (Test-Path $cand.Py) {
            return @{ Path = $cand.Py; EnvRoot = $cand.Root; IsVenv = $true; Source = "$($cand.Kind) ($($cand.Py))" }
        }
    }

    # Fallback: verified system Python (skip MSYS2 or Conda base per CLAUDE.md)
    $allPy = Get-Command python.exe -All -ErrorAction SilentlyContinue
    foreach ($item in $allPy) {
        $src = $item.Source
        if ($src -and $src -notmatch "msys" -and $src -notmatch "\\(anaconda3|miniconda3)\\python\.exe$" -and $src -notmatch "WindowsApps") {
            return @{ Path = $src; EnvRoot = (Split-Path -Parent $src); IsVenv = $false; Source = "System Python ($src; no .venv directory needed per CLAUDE.md)" }
        }
    }

    if (Test-Path "C:\Program Files\Python313\python.exe") {
        return @{ Path = "C:\Program Files\Python313\python.exe"; EnvRoot = "C:\Program Files\Python313"; IsVenv = $false; Source = "System Python (C:\Program Files\Python313\python.exe)" }
    }
    return $null
}

function Import-EnvFileSafely {
    param([string]$EnvPath)
    if (-not (Test-Path $EnvPath)) {
        return @()
    }
    $loadedKeys = @()
    foreach ($rawLine in (Get-Content -Path $EnvPath -Encoding UTF8)) {
        $line = $rawLine.Trim()
        if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith("#")) { continue }
        if ($line -match "^([A-Za-z_][A-Za-z0-9_]*)=(.*)$") {
            $k = $Matches[1]
            $v = $Matches[2].Trim()
            if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
                if ($v.Length -ge 2) { $v = $v.Substring(1, $v.Length - 2) }
            }
            [System.Environment]::SetEnvironmentVariable($k, $v, "Process")
            $loadedKeys += $k
        }
    }
    return $loadedKeys
}

function Invoke-StartLauncher {
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host "   NASA ASTERA WATCH - ONE-CLICK APPLICATION LAUNCHER (RUN.bat)       " -ForegroundColor Cyan
    Write-Host "   SAR Wildfire Before/After Analysis & Real Model Inference          " -ForegroundColor Cyan
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-LauncherLog "Starting NASA Astera Watch from WorkspaceRoot='$WorkspaceRoot', AppRoot='$AppRoot'" "INFO"

    # 1. Duplicate instance / Port conflict detection
    $existingBackendPid = Get-PortOwnerPid -Port $BackendPort
    $existingFrontendPid = Get-PortOwnerPid -Port $FrontendPort

    if ($null -ne $existingBackendPid -or $null -ne $existingFrontendPid) {
        Write-LauncherLog "Detected existing listener(s): Port $BackendPort PID=$existingBackendPid, Port $FrontendPort PID=$existingFrontendPid" "WARN"
        $isOurBackend  = ($null -ne $existingBackendPid) -and (Test-IsAsteraProcess -PidValue $existingBackendPid)
        $isOurFrontend = ($null -ne $existingFrontendPid) -and (Test-IsAsteraProcess -PidValue $existingFrontendPid)

        if (
            (($null -eq $existingBackendPid) -or $isOurBackend) -and
            (($null -eq $existingFrontendPid) -or $isOurFrontend)
        ) {
            Write-LauncherLog "Existing Astera Watch instance detected. Cycling previous launcher-managed processes cleanly..." "INFO"
            Invoke-StopLauncher
        } else {
            if ($null -ne $existingBackendPid -and -not $isOurBackend) {
                $cmdB = Get-ProcessCommandLine -PidValue $existingBackendPid
                Write-LauncherLog "PORT CONFLICT: Port $BackendPort is already occupied by external PID $existingBackendPid ($cmdB)." "ERROR"
                exit 1
            }
            if ($null -ne $existingFrontendPid -and -not $isOurFrontend) {
                $cmdF = Get-ProcessCommandLine -PidValue $existingFrontendPid
                Write-LauncherLog "PORT CONFLICT: Port $FrontendPort is already occupied by external PID $existingFrontendPid ($cmdF)." "ERROR"
                exit 1
            }
        }
    }

    # 2. Detect & Activate Python Environment + Detect Node.js
    $pyInfo = Find-PythonInterpreter
    if ($null -eq $pyInfo) {
        Write-LauncherLog "Python 3.11+ was not found on this machine. Please install Python 3.11+ or create a .venv in $AppRoot." "ERROR"
        exit 1
    }
    $PythonExe = $pyInfo.Path
    if ($pyInfo.IsVenv) {
        $env:VIRTUAL_ENV = $pyInfo.EnvRoot
        $scriptsPath = Join-Path $pyInfo.EnvRoot "Scripts"
        $env:PATH = "$scriptsPath;$($pyInfo.EnvRoot);$($env:PATH)"
        Write-LauncherLog "Activated Python virtual environment: $($pyInfo.Source)" "OK"
    } else {
        Write-LauncherLog "Python interpreter verified: $($pyInfo.Source)" "OK"
    }
    $pyVer = (& $PythonExe --version 2>&1) -join " "
    Write-LauncherLog "Python version: $pyVer" "OK"

    $nodeCmd = Get-Command node.exe -ErrorAction SilentlyContinue
    $npmCmd  = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if ($null -eq $nodeCmd -or $null -eq $npmCmd) {
        Write-LauncherLog "Node.js / npm.cmd not found in PATH. Please install Node.js 20+ / 22+." "ERROR"
        exit 1
    }
    $nodeVer = (& $nodeCmd.Source --version 2>&1) -join " "
    $npmVer  = (& $npmCmd.Source --version 2>&1) -join " "
    Write-LauncherLog "Node.js detected: $nodeVer | npm: $npmVer" "OK"

    # 3. Verify Environment Configuration (.env) WITHOUT exposing secrets
    $envFile = Join-Path $AppRoot ".env"
    $envExample = Join-Path $AppRoot ".env.example"
    if (Test-Path $envFile) {
        $envKeys = Import-EnvFileSafely -EnvPath $envFile
        Write-LauncherLog "Loaded .env configuration safely ($($envKeys.Count) keys verified; values hidden): $($envKeys -join ', ')" "OK"
    } elseif (Test-Path $envExample) {
        Write-LauncherLog "No .env file present; operating in verified local file-backed real-data mode (USE_MOCK_DATA=false)." "INFO"
    }

    # Optional local PostgreSQL status check (non-blocking since runtime uses versioned file-backed artifacts)
    $pgSvc = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -ne $pgSvc) {
        Write-LauncherLog "Optional database service detected: $($pgSvc.Name) (Status: $($pgSvc.Status))." "INFO"
    } else {
        Write-LauncherLog "Database mode: file-backed JSON/GeoTIFF/NPZ artifacts (no external database daemon required)." "INFO"
    }

    # 4. Pre-Flight Python Dependency, Dataset, and Trained ML Model Check
    Write-LauncherLog "Verifying Python ML/geospatial packages, dataset manifests, and trained checkpoints..." "INFO"
    if (-not (Test-Path $PreflightPy)) {
        Write-LauncherLog "Missing preflight helper script: $PreflightPy" "ERROR"
        exit 1
    }
    $env:ASTERA_APP_ROOT = $AppRoot
    $preflightOut = & $PythonExe $PreflightPy 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-LauncherLog "Pre-flight ML/dependency verification FAILED: $($preflightOut -join ' ')" "ERROR"
        exit 1
    }
    Write-LauncherLog "Pre-flight check passed: $($preflightOut | Select-Object -Last 1)" "OK"

    # 5. Verify Frontend_ directory, package.json scripts, and dependencies
    $pkgJsonPath = Join-Path $FrontendDir "package.json"
    if (-not (Test-Path $FrontendDir) -or -not (Test-Path $pkgJsonPath)) {
        Write-LauncherLog "Required Frontend_ directory or package.json not found. Checked: $($FrontendCandidates -join ', ')" "ERROR"
        exit 1
    }
    $pkgJson = Get-Content -Path $pkgJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $devScript = $pkgJson.scripts.dev
    if ([string]::IsNullOrWhiteSpace($devScript)) {
        Write-LauncherLog "Frontend_ package.json is missing a 'dev' script ($pkgJsonPath)." "ERROR"
        exit 1
    }
    Write-LauncherLog "Frontend_ verified: $FrontendDir (package.json dev script='$devScript')" "OK"

    $nodeModulesDir = Join-Path $FrontendDir "node_modules"
    $viteCliJs      = Join-Path $FrontendDir "node_modules\vite\bin\vite.js"
    if (-not (Test-Path $nodeModulesDir) -or -not (Test-Path $viteCliJs)) {
        Write-LauncherLog "Frontend_ node_modules missing or incomplete. Running npm.cmd install in $FrontendDir..." "INFO"
        Push-Location $FrontendDir
        try {
            & $npmCmd.Source install
            if ($LASTEXITCODE -ne 0) {
                throw "npm install failed with exit code $LASTEXITCODE"
            }
        } finally {
            Pop-Location
        }
    }
    Write-LauncherLog "Frontend_ dependencies verified ($FrontendDir\node_modules)." "OK"

    # 6. Start FastAPI Backend in its own persistent minimized terminal window
    $backendLog = Join-Path $LogsDir "backend.log"
    if (Test-Path $backendLog) { Remove-Item $backendLog -Force -ErrorAction SilentlyContinue }

    $backendTitle = "NASA Astera Watch - FastAPI Backend (Port $BackendPort)"
    $backendInnerCmd = "`"$PythonExe`" `"$RunnerPy`" --title `"$backendTitle`" --cwd `"$AppRoot`" --log `"$backendLog`" -- `"$PythonExe`" -m uvicorn backend.app.main:app --host $BackendHost --port $BackendPort"
    Write-LauncherLog "Launching FastAPI Backend terminal window on http://${BackendHost}:${BackendPort} ..." "INFO"
    $backendProc = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/s /k `"$backendInnerCmd`"" `
        -WorkingDirectory $AppRoot `
        -WindowStyle Minimized `
        -PassThru

    # 7. Poll Backend HTTP Health & Model Readiness
    $backendReady = $false
    $healthData = $null
    $modelsData = $null
    for ($i = 1; $i -le 45; $i++) {
        if ($backendProc.HasExited) {
            $logTail = if (Test-Path $backendLog) { (Get-Content $backendLog -Tail 25) -join "`n" } else { "No backend log output" }
            Write-LauncherLog "FastAPI Backend terminal exited prematurely (ExitCode=$($backendProc.ExitCode)). Log:`n$logTail" "ERROR"
            exit 1
        }
        try {
            $healthResp = Invoke-RestMethod -Uri "http://${BackendHost}:${BackendPort}/api/health" -Method Get -TimeoutSec 2 -ErrorAction Stop
            if ($healthResp.status -eq "ONLINE" -and $healthResp.ml_ready -eq $true -and $healthResp.checkpoints_ready -eq $true) {
                $modelsResp = Invoke-RestMethod -Uri "http://${BackendHost}:${BackendPort}/api/models/available" -Method Get -TimeoutSec 3 -ErrorAction Stop
                $notReady = @($modelsResp.models | Where-Object { $_.status -ne "READY" })
                if ($notReady.Count -gt 0) {
                    $missingNames = ($notReady | ForEach-Object { "$($_.registry_key)=$($_.status)" }) -join ", "
                    throw "Required ML model(s) not ready: $missingNames"
                }
                $healthData = $healthResp
                $modelsData = $modelsResp
                $backendReady = $true
                break
            }
        } catch {
            if ($_.Exception.Message -match "Required ML model") {
                Stop-ProcessTreeSafe -RootPid $backendProc.Id -Label "FastAPI Backend"
                Write-LauncherLog $_.Exception.Message "ERROR"
                exit 1
            }
            Start-Sleep -Milliseconds 700
        }
    }

    if (-not $backendReady) {
        $logTail = if (Test-Path $backendLog) { (Get-Content $backendLog -Tail 25) -join "`n" } else { "No backend log output" }
        Stop-ProcessTreeSafe -RootPid $backendProc.Id -Label "FastAPI Backend"
        Write-LauncherLog "Timed out waiting for FastAPI Backend at http://${BackendHost}:${BackendPort}/api/health. Log:`n$logTail" "ERROR"
        exit 1
    }

    $actualBackendPid = Get-PortOwnerPid -Port $BackendPort
    if ($null -eq $actualBackendPid) { $actualBackendPid = $backendProc.Id }
    Write-LauncherLog "FastAPI Backend ONLINE (Listen PID=$actualBackendPid, Window PID=$($backendProc.Id)) | Active Run=$($healthData.active_run_id) | Models READY=$($modelsData.models.Count)" "OK"

    # 8. Start Vite Frontend in its own persistent minimized terminal window
    $frontendLog = Join-Path $LogsDir "frontend.log"
    if (Test-Path $frontendLog) { Remove-Item $frontendLog -Force -ErrorAction SilentlyContinue }

    $frontendTitle = "NASA Astera Watch - Vite Frontend_ (Port $FrontendPort)"
    $frontendInnerCmd = "`"$PythonExe`" `"$RunnerPy`" --title `"$frontendTitle`" --cwd `"$FrontendDir`" --log `"$frontendLog`" -- `"$($npmCmd.Source)`" run dev -- --host $FrontendHost --port $FrontendPort"
    Write-LauncherLog "Launching Vite Frontend_ terminal window (npm run dev in $FrontendDir) on http://${FrontendHost}:${FrontendPort} ..." "INFO"
    $frontendProc = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/s /k `"$frontendInnerCmd`"" `
        -WorkingDirectory $FrontendDir `
        -WindowStyle Minimized `
        -PassThru

    # 9. Poll Frontend HTTP 200 & Proxied Backend Connectivity (/api/health via Vite)
    $frontendReady = $false
    for ($i = 1; $i -le 45; $i++) {
        if ($frontendProc.HasExited) {
            $logTail = if (Test-Path $frontendLog) { (Get-Content $frontendLog -Tail 25) -join "`n" } else { "No frontend log output" }
            Write-LauncherLog "Vite Frontend terminal exited prematurely (ExitCode=$($frontendProc.ExitCode)). Log:`n$logTail" "ERROR"
            Stop-ProcessTreeSafe -RootPid $backendProc.Id -Label "FastAPI Backend"
            exit 1
        }
        try {
            $webResp = Invoke-WebRequest -Uri "http://${FrontendHost}:${FrontendPort}/" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            $proxyResp = Invoke-RestMethod -Uri "http://${FrontendHost}:${FrontendPort}/api/health" -Method Get -TimeoutSec 2 -ErrorAction Stop
            if ($webResp.StatusCode -eq 200 -and $proxyResp.status -eq "ONLINE") {
                $frontendReady = $true
                break
            }
        } catch {
            Start-Sleep -Milliseconds 600
        }
    }

    if (-not $frontendReady) {
        $logTail = if (Test-Path $frontendLog) { (Get-Content $frontendLog -Tail 25) -join "`n" } else { "No frontend log output" }
        Stop-ProcessTreeSafe -RootPid $frontendProc.Id -Label "Vite Frontend"
        Stop-ProcessTreeSafe -RootPid $backendProc.Id -Label "FastAPI Backend"
        Write-LauncherLog "Timed out waiting for Vite Frontend at http://${FrontendHost}:${FrontendPort}/. Log:`n$logTail" "ERROR"
        exit 1
    }

    $actualFrontendPid = Get-PortOwnerPid -Port $FrontendPort
    if ($null -eq $actualFrontendPid) { $actualFrontendPid = $frontendProc.Id }
    Write-LauncherLog "Vite Frontend ONLINE (Listen PID=$actualFrontendPid, Window PID=$($frontendProc.Id)) | Proxy /api -> http://${BackendHost}:${BackendPort} verified." "OK"

    # 10. Save PID state to .astera_runtime/launcher_state.json
    $statePayload = [ordered]@{
        started_at_utc      = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        workspace_root      = $WorkspaceRoot
        app_root            = $AppRoot
        python_exe          = $PythonExe
        node_exe            = $nodeCmd.Source
        backend_port        = $BackendPort
        backend_pid         = $actualBackendPid
        backend_window_pid  = $backendProc.Id
        backend_log         = $backendLog
        frontend_port       = $FrontendPort
        frontend_dir        = $FrontendDir
        frontend_pid        = $actualFrontendPid
        frontend_window_pid = $frontendProc.Id
        frontend_log        = $frontendLog
        active_run_id       = $healthData.active_run_id
    }
    $statePayload | ConvertTo-Json -Depth 5 | Set-Content -Path $StateFile -Encoding UTF8

    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Green
    Write-Host "   NASA ASTERA WATCH IS RUNNING AND READY                             " -ForegroundColor Green
    Write-Host "======================================================================" -ForegroundColor Green
    Write-Host "  Frontend Application URL : http://127.0.0.1:5173" -ForegroundColor White
    Write-Host "  Live SAR Inference URL   : http://127.0.0.1:5173/live-inference" -ForegroundColor White
    Write-Host "  Frontend Directory       : $FrontendDir" -ForegroundColor Gray
    Write-Host "  Backend API Base URL     : http://127.0.0.1:8000/api" -ForegroundColor White
    Write-Host "  Interactive Swagger Docs : http://127.0.0.1:8000/docs" -ForegroundColor White
    Write-Host "  Backend Health Endpoint  : http://127.0.0.1:8000/api/health" -ForegroundColor White
    Write-Host "  Active Versioned Run     : $($healthData.active_run_id)" -ForegroundColor Cyan
    Write-Host "  Loaded SAR ML Models     : $(($modelsData.models | ForEach-Object { "$($_.registry_key) [$($_.status)]" }) -join ', ')" -ForegroundColor Cyan
    Write-Host "  Runtime Logs Directory   : $LogsDir" -ForegroundColor Gray
    Write-Host "  Service Terminal Windows : 2 minimized console windows kept open" -ForegroundColor Gray
    Write-Host "  To Stop Safely           : Double-click STOP.bat" -ForegroundColor Yellow
    Write-Host "======================================================================" -ForegroundColor Green

    if (-not $NoBrowser) {
        try {
            Start-Process "http://127.0.0.1:5173" | Out-Null
        } catch {}
    }

    if ($KeepAlive -or (-not $NoPause)) {
        Write-Host ""
        Write-Host "Launcher monitor active. Both Backend and Frontend terminal windows remain open." -ForegroundColor Gray
        Write-Host "Double-click STOP.bat at any time for safe shutdown." -ForegroundColor Gray
        while ($true) {
            Start-Sleep -Seconds 3
            if ($backendProc.HasExited -and $frontendProc.HasExited) {
                Write-LauncherLog "Both managed service windows exited." "INFO"
                break
            }
        }
    }
}

function Invoke-StatusLauncher {
    $bPid = Get-PortOwnerPid -Port $BackendPort
    $fPid = Get-PortOwnerPid -Port $FrontendPort
    Write-Host "Backend Port $BackendPort PID  : $(if ($bPid) { $bPid } else { 'NOT LISTENING' })"
    Write-Host "Frontend Port $FrontendPort PID : $(if ($fPid) { $fPid } else { 'NOT LISTENING' })"
    if (Test-Path $StateFile) {
        Write-Host "State File ($StateFile):"
        Get-Content $StateFile
    }
}

switch ($Action) {
    "Start"  { Invoke-StartLauncher }
    "Stop"   { Invoke-StopLauncher }
    "Status" { Invoke-StatusLauncher }
}

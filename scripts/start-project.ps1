param([switch]$Worker)

$root = Split-Path -Parent $PSScriptRoot
$url = "http://localhost:3000"
$healthUrl = "http://127.0.0.1:3000"
$log = Join-Path $root "start-project.log"

function Open-AppUrl {
  Start-Process "explorer.exe" $url
}

if (-not $Worker) {
  $scriptPath = '"' + $PSCommandPath + '"'
  Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    $scriptPath,
    "-Worker"
  )
  exit
}

function Test-Ready {
  try {
    $response = Invoke-WebRequest $healthUrl -UseBasicParsing -TimeoutSec 1
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Test-TcpPort {
  param(
    [string]$HostName,
    [int]$Port,
    [int]$TimeoutMs = 500
  )

  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect($HostName, $Port, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne($TimeoutMs, $false)) {
      return $false
    }

    $client.EndConnect($async)
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Test-DockerReady {
  cmd.exe /c "docker info >nul 2>&1"
  return $LASTEXITCODE -eq 0
}

function Start-DockerDesktopIfAvailable {
  $dockerDesktopPath = Join-Path $Env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
  if (-not (Test-Path -LiteralPath $dockerDesktopPath)) {
    return $false
  }

  Start-Process -FilePath $dockerDesktopPath | Out-Null

  for ($i = 0; $i -lt 5; $i++) {
    if (Test-DockerReady) {
      return $true
    }

    Start-Sleep -Seconds 1
  }

  return $false
}

function Invoke-LoggedCommand {
  param(
    [string]$Command,
    [string]$FailureMessage
  )

  Add-Content -LiteralPath $log -Value ""
  Add-Content -LiteralPath $log -Value "> $Command"

  $process = Start-Process cmd.exe `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -Wait `
    -PassThru `
    -ArgumentList "/c $Command >> start-project.log 2>&1"

  if ($process.ExitCode -ne 0) {
    Add-Content -LiteralPath $log -Value $FailureMessage
    Start-Process notepad.exe $log
    return $false
  }

  return $true
}

$createdNew = $false
$mutex = New-Object System.Threading.Mutex($true, "YinzaoStartProjectMutex", [ref]$createdNew)
if (-not $createdNew) {
  if (Test-Ready) {
    Open-AppUrl
  }
  exit
}

try {
  if (Test-Ready) {
    Open-AppUrl
    exit
  }

  Set-Content -LiteralPath $log -Value "Starting Yinzao dev server..." -Encoding UTF8

  if (-not (Test-TcpPort "127.0.0.1" 5432)) {
    if (-not (Test-DockerReady)) {
      Add-Content -LiteralPath $log -Value ""
      Add-Content -LiteralPath $log -Value "Docker Desktop is not ready. Trying to start Docker Desktop..."

      if (-not (Start-DockerDesktopIfAvailable)) {
        Add-Content -LiteralPath $log -Value "Docker Desktop did not become ready within 5 seconds. Please restart Docker Desktop manually, wait until it finishes starting, then run this script again."
        Start-Process notepad.exe $log
        exit
      }
    }

    if (-not (Invoke-LoggedCommand "docker compose up -d" "Failed to start local PostgreSQL. Please restart Docker Desktop and try again.")) {
      exit
    }
  } else {
    Add-Content -LiteralPath $log -Value "Local PostgreSQL is already listening on 127.0.0.1:5432. Skipping Docker startup."
  }

  $prismaCommand = "npx prisma migrate deploy"
  if (Test-Path -LiteralPath (Join-Path $root "node_modules\.bin\prisma.cmd")) {
    $prismaCommand = "node_modules\.bin\prisma.cmd migrate deploy"
  }

  if (-not (Invoke-LoggedCommand $prismaCommand "Failed to apply database migrations. Please check start-project.log.")) {
    exit
  }

  Start-Process cmd.exe `
      -WorkingDirectory $root `
      -WindowStyle Hidden `
      -ArgumentList "/c npm run dev >> start-project.log 2>&1"

  for ($i = 0; $i -lt 600; $i++) {
    if (Test-Ready) {
      Open-AppUrl
      exit
    }

    Start-Sleep -Milliseconds 500
  }

  if (Test-Ready) {
    Open-AppUrl
    exit
  }

  Add-Content $log "Startup timed out. Please check Node/npm or whether port 3000 is occupied."
  Start-Process notepad.exe $log
} finally {
  if ($createdNew) {
    $mutex.ReleaseMutex()
  }
  $mutex.Dispose()
}

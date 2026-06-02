param([switch]$Worker)

$root = Split-Path -Parent $PSScriptRoot
$url = "http://localhost:3000/admin"
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
    $response = Invoke-WebRequest $healthUrl -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
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

  Set-Content -LiteralPath $log -Value "Starting FlashMuse admin dev server..." -Encoding UTF8
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

  Add-Content $log "Admin startup timed out. Please check Node/npm or whether port 3000 is occupied."
  Start-Process notepad.exe $log
} finally {
  if ($createdNew) {
    $mutex.ReleaseMutex()
  }
  $mutex.Dispose()
}

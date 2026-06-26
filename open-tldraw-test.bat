@echo off
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri 'http://localhost:3000/dev/tldraw-test' -UseBasicParsing -TimeoutSec 2 | Out-Null } catch { Start-Process -FilePath 'cmd.exe' -ArgumentList '/k npm run dev' -WorkingDirectory (Get-Location).Path; Start-Sleep -Seconds 4 }"
start "" "http://localhost:3000/dev/tldraw-test"

endlocal

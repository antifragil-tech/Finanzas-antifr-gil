@echo off
cd /d "%~dp0.."
mkdir "scheduler\logs" 2>nul

REM Matar instancias previas bloqueadas del mismo script
powershell -NonInteractive -NoProfile -Command "Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -like '*daily_sync*' -and $_.Name -like 'python*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" 2>nul

echo. >> "scheduler\logs\daily_sync.log"
echo ============================================================ >> "scheduler\logs\daily_sync.log"
echo [%date% %time%] START Alsari Daily Sync >> "scheduler\logs\daily_sync.log"
echo ============================================================ >> "scheduler\logs\daily_sync.log"
".venv\Scripts\python.exe" "scripts\daily_sync.py" >> "scheduler\logs\daily_sync.log" 2>&1
echo [%date% %time%] END (exit %ERRORLEVEL%) >> "scheduler\logs\daily_sync.log"
exit /b %ERRORLEVEL%

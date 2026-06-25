@echo off
cd /d "%~dp0.."
mkdir "scheduler\logs" 2>nul

REM Matar instancias previas bloqueadas del mismo script
powershell -NonInteractive -NoProfile -Command "Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -like '*generate_drafts*' -and $_.Name -like 'python*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" 2>nul

echo. >> "scheduler\logs\generate_drafts.log"
echo ============================================================ >> "scheduler\logs\generate_drafts.log"
echo [%date% %time%] START Alsari Generate Drafts >> "scheduler\logs\generate_drafts.log"
echo ============================================================ >> "scheduler\logs\generate_drafts.log"
".venv\Scripts\python.exe" "scripts\generate_drafts.py" >> "scheduler\logs\generate_drafts.log" 2>&1
echo [%date% %time%] END (exit %ERRORLEVEL%) >> "scheduler\logs\generate_drafts.log"
exit /b %ERRORLEVEL%

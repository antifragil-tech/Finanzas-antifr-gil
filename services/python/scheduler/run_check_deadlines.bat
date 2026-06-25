@echo off
cd /d "%~dp0.."
mkdir "scheduler\logs" 2>nul

REM Matar instancias previas bloqueadas del mismo script
powershell -NonInteractive -NoProfile -Command "Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -like '*check_deadlines*' -and $_.Name -like 'python*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" 2>nul

echo. >> "scheduler\logs\check_deadlines.log"
echo ============================================================ >> "scheduler\logs\check_deadlines.log"
echo [%date% %time%] START Alsari Check Deadlines >> "scheduler\logs\check_deadlines.log"
echo ============================================================ >> "scheduler\logs\check_deadlines.log"
".venv\Scripts\python.exe" "scripts\check_deadlines.py" >> "scheduler\logs\check_deadlines.log" 2>&1
echo [%date% %time%] END (exit %ERRORLEVEL%) >> "scheduler\logs\check_deadlines.log"
exit /b %ERRORLEVEL%

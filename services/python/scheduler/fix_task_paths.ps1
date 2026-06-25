# Auto-elevacion UAC
If (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process PowerShell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    Exit
}

$base = "C:\Users\guill\OneDrive\Desktop\Alsari Capital OS\alsari-os-v0.2\services\python"

$tasks = @{
    "Alsari Check Deadlines" = "$base\scheduler\run_check_deadlines.bat"
    "Alsari Daily Sync"      = "$base\scheduler\run_daily_sync.bat"
    "Alsari Generate Drafts" = "$base\scheduler\run_generate_drafts.bat"
}

foreach ($name in $tasks.Keys) {
    try {
        $task = Get-ScheduledTask -TaskName $name -ErrorAction Stop
        $action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$($tasks[$name])`""
        Set-ScheduledTask -TaskName $name -Action $action -ErrorAction Stop | Out-Null
        Write-Host "OK: $name" -ForegroundColor Green
    } catch {
        Write-Host "FAIL: $name - $_" -ForegroundColor Red
    }
}

Write-Host "`nTareas actualizadas al nuevo path del monorepo." -ForegroundColor Cyan
Read-Host "Pulsa Enter para cerrar"

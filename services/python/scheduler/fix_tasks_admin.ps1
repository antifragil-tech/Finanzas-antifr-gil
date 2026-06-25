# Auto-elevacion: si no es admin, relanza el script con UAC (solo hay que pulsar "Si")
If (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process PowerShell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    Exit
}

$tasks = "Alsari Daily Sync", "Alsari Check Deadlines", "Alsari Generate Drafts"
$userId = $env:USERDOMAIN + "\" + $env:USERNAME

foreach ($t in $tasks) {
    try {
        $task = Get-ScheduledTask -TaskName $t -ErrorAction Stop
        $principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType S4U -RunLevel Highest
        Set-ScheduledTask -TaskName $t -Principal $principal | Out-Null
        Write-Host "OK: $t" -ForegroundColor Green
    } catch {
        Write-Host "FAIL: $t - $_" -ForegroundColor Red
    }
}

Write-Host "`nListo. Las tareas ya no se interrumpiran al bloquear el PC." -ForegroundColor Cyan
Read-Host "Pulsa Enter para cerrar"

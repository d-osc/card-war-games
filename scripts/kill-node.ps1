Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -like '*card-war*' } | ForEach-Object {
  Write-Output "kill $($_.ProcessId): $($_.CommandLine.Substring(0, [Math]::Min(90, $_.CommandLine.Length)))"
  Stop-Process -Id $_.ProcessId -Force
}
Write-Output 'done'

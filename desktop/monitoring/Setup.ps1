param([switch]$Remove)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Security
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
$store=Join-Path $env:ProgramData 'MountainTorqMonitoring'
$taskName='Mountain Torq Device Monitoring'
try {
  if(!([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Run setup as a Windows administrator.'}
  if((Test-Path $store) -and ((Get-Item $store).Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Monitoring folder must not be a link.'}
  if($Remove) {
    if(Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue){Stop-ScheduledTask -TaskName $taskName;Unregister-ScheduledTask -TaskName $taskName -Confirm:$false}
    if(Test-Path $store){Remove-Item $store -Recurse -Force}
    [Windows.Forms.MessageBox]::Show('Background monitoring removed. Ticketing is unchanged.','Mountain Torq') | Out-Null
    exit 0
  }
  $picker=New-Object Windows.Forms.OpenFileDialog
  $picker.Title='Select the device enrollment file created by IT Admin'
  $picker.Filter='Device enrollment (*.json)|*.json'
  if($picker.ShowDialog() -ne 'OK'){exit 0}
  if((Get-Item $picker.FileName).Length -gt 16384){throw 'Invalid enrollment file.'}
  $config=Get-Content $picker.FileName -Raw | ConvertFrom-Json
  if($config.deviceId -notmatch '^[A-Za-z0-9_-]{1,128}$' -or $config.apiKey -ne 'AIzaSyCYw7zgHU2kxjf027_3sbR-76ba66yH9RY' -or $config.databaseURL -ne 'https://ticketing-a8461-default-rtdb.asia-southeast1.firebasedatabase.app'){throw 'This is not a Mountain Torq device enrollment file.'}
  $login=Invoke-RestMethod -Method Post -Uri ('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+$config.apiKey) -ContentType 'application/json' -Body (@{email=$config.email;password=$config.password;returnSecureToken=$true} | ConvertTo-Json) -TimeoutSec 20
  if($login.localId -ne $config.deviceId){throw 'Device identity mismatch.'}
  $device=Invoke-RestMethod -Uri ($config.databaseURL+'/monitoringDevices/'+$config.deviceId+'.json?auth='+[Uri]::EscapeDataString($login.idToken)) -TimeoutSec 20
  if(!$device.active){throw 'This device is not active. Ask IT Admin to check its enrollment and Firebase rules.'}
  $confirm=[Windows.Forms.MessageBox]::Show('Enable background hardware and performance monitoring for '+$device.name+'? It runs every minute, even when signed out. IT Admin, IT Technicians and Management can view readings.','Enable monitoring','YesNo')
  if($confirm -ne 'Yes'){exit 0}
  if(Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue){Stop-ScheduledTask -TaskName $taskName}
  $null=New-Item -ItemType Directory -Path $store -Force
  $acl=New-Object Security.AccessControl.DirectorySecurity
  if(@(Get-ChildItem -LiteralPath $store -Force -Recurse | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count){throw 'Monitoring files must not be links.'}
  $acl.SetAccessRuleProtection($true,$false)
  $acl.SetOwner((New-Object Security.Principal.SecurityIdentifier('S-1-5-32-544')))
  foreach($sid in @('S-1-5-18','S-1-5-32-544')) {
    $rule=New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier($sid)),'FullControl','ContainerInherit,ObjectInherit','None','Allow')
    $acl.AddAccessRule($rule)
  }
  Set-Acl -LiteralPath $store -AclObject $acl
  & icacls.exe $store /setowner '*S-1-5-32-544' /T /Q | Out-Null
  if($LASTEXITCODE -ne 0){throw 'Could not secure monitoring ownership.'}
  foreach($child in Get-ChildItem -LiteralPath $store -Force) {
    & icacls.exe $child.FullName /reset /T /Q | Out-Null
    if($LASTEXITCODE -ne 0){throw 'Could not secure monitoring files.'}
  }
  foreach ($cache in @('inventory.json','inventory-sent.txt','network.json','history-slot.txt','public-ip.json')) {
    Remove-Item (Join-Path $store $cache) -Force -ErrorAction SilentlyContinue
  }
  Copy-Item (Join-Path $PSScriptRoot 'Collect.ps1') (Join-Path $store 'Collect.ps1') -Force
  @{deviceId=$config.deviceId;apiKey=$config.apiKey} | ConvertTo-Json | Set-Content (Join-Path $store 'config.json')
  $encrypted=[Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($login.refreshToken),$null,[Security.Cryptography.DataProtectionScope]::LocalMachine)
  [Convert]::ToBase64String($encrypted) | Set-Content (Join-Path $store 'credentials.dat')
  $exe=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $action=New-ScheduledTaskAction -Execute $exe -Argument ('-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+(Join-Path $store 'Collect.ps1')+'"')
  $triggers=@((New-ScheduledTaskTrigger -AtStartup),(New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)))
  $settings=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Seconds 55) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $triggers -Settings $settings -User 'SYSTEM' -RunLevel Highest -Force | Out-Null
  Start-ScheduledTask -TaskName $taskName
  [Windows.Forms.MessageBox]::Show('Monitoring installed. Check Device Monitoring on the website in 1-2 minutes. Delete the downloaded enrollment file after setup.','Mountain Torq') | Out-Null
} catch {
  [Windows.Forms.MessageBox]::Show('Setup failed. Check Windows administrator permission, the enrollment file, internet access, and published Firebase monitoring rules. No ticket settings were changed.','Mountain Torq') | Out-Null
  exit 1
}

param([switch]$Test)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.Security
$store = Join-Path $env:ProgramData 'MountainTorqMonitoring'
function TryValue($action) { try { & $action } catch { $null } }
function Clip($value, $length=2000) { $s = [string]$value; $s.Substring(0,[Math]::Min($s.Length,$length)) }
. (Join-Path $PSScriptRoot 'Credentials.ps1')
$stage='starting'
$runLock=$null
function ParsePublicIP($value, $family) {
  $parsed=$null
  if([Net.IPAddress]::TryParse([string]$value,[ref]$parsed) -and $parsed.AddressFamily.ToString() -eq $family) {return $parsed.ToString()}
  return ''
}
function GetReading {
  $os = Get-CimInstance Win32_OperatingSystem
  $cs = Get-CimInstance Win32_ComputerSystem
  $cpu = @(Get-CimInstance Win32_Processor)
  $load = ($cpu | Measure-Object -Property LoadPercentage -Average).Average
  if ($null -eq $load) { $load = 0 }
  $ram = [Math]::Round(100*(1-$os.FreePhysicalMemory/$os.TotalVisibleMemorySize),1)
  $disks = @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | Where-Object Size -gt 0 | ForEach-Object {
    @{name=$_.DeviceID;totalGB=[Math]::Round($_.Size/1GB,1);freeGB=[Math]::Round($_.FreeSpace/1GB,1);usedPercent=[Math]::Round(100*(1-$_.FreeSpace/$_.Size),1)}
  })
  $ping = TryValue { $p=New-Object Net.NetworkInformation.Ping; try { $r=$p.Send('1.1.1.1',1500); if($r.Status -eq 'Success') {[double]$r.RoundtripTime} } finally {$p.Dispose()} }
  $inventoryPath=Join-Path $store 'inventory.json'
  $inv=$null
  if(!$Test) {$inv=TryValue {Get-Content $inventoryPath -Raw | ConvertFrom-Json}}
  if(!$inv -or [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()-$inv.at -gt 21600000) {
  $health = TryValue { @(Get-CimInstance -Namespace root/wmi -ClassName MSStorageDriver_FailurePredictStatus) }
  $diskHealth = 'Unavailable'; if($null -ne $health -and @($health).Count -gt 0) { $diskHealth = 'No failure predicted'; if(@($health | Where-Object PredictFailure).Count) {$diskHealth='Warning'} }
  $thermal = TryValue { Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature | Select-Object -First 1 }
  $batteryFull = TryValue { Get-CimInstance -Namespace root/wmi -ClassName BatteryFullChargedCapacity | Select-Object -First 1 }
  $batteryDesign = TryValue { Get-CimInstance -Namespace root/wmi -ClassName BatteryStaticData | Select-Object -First 1 }
  $inv = @{
    at=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();manufacturer=Clip $cs.Manufacturer;model=Clip $cs.Model
    serial=Clip (TryValue {(Get-CimInstance Win32_BIOS).SerialNumber});os=Clip ($os.Caption+' '+$os.Version)
    cpuModel=Clip (($cpu | ForEach-Object Name) -join '; ');diskHealth=$diskHealth
    ip=Clip ((TryValue {Get-CimInstance Win32_NetworkAdapterConfiguration -Filter 'IPEnabled=True' | ForEach-Object IPAddress}) -join ', ')
    adapters=Clip ((TryValue {Get-CimInstance Win32_NetworkAdapter -Filter 'NetEnabled=True' | ForEach-Object Name}) -join '; ')
    antivirus=Clip ((TryValue {Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntivirusProduct | ForEach-Object { $_.displayName + ' (reported state ' + $_.productState + ')' }}) -join '; ')
    software=Clip ((TryValue {Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object DisplayName | ForEach-Object { $_.DisplayName + ' ' + $_.DisplayVersion } | Sort-Object -Unique}) -join "`n") 12000
  }
  if ($thermal -and $thermal.CurrentTemperature -gt 2731) {$inv.temperatureC=[Math]::Round($thermal.CurrentTemperature/10-273.15,1)}
  if ($batteryDesign.DesignedCapacity -gt 0 -and $batteryFull.FullChargedCapacity -gt 0) {$inv.batteryHealth=[Math]::Round([Math]::Min(100,100*$batteryFull.FullChargedCapacity/$batteryDesign.DesignedCapacity),1)}
  if(!$Test) {$inv | ConvertTo-Json -Depth 4 | Set-Content $inventoryPath}
  }
  $r=@{at=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();hostname=$env:COMPUTERNAME;user=Clip $cs.UserName;cpu=[Math]::Round($load,1);memory=$ram;memoryGB=[Math]::Round($cs.TotalPhysicalMemory/1GB,1);uptimeHours=[Math]::Round(((Get-Date)-$os.LastBootUpTime).TotalHours,1);disks=$disks;inventory=$inv;rebootPending=((Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired') -or (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending'))}
  if ($null -ne $ping) {$r.pingMs=$ping}
  $interfaces = @(TryValue {
    Get-CimInstance Win32_NetworkAdapterConfiguration -Filter 'IPEnabled=True' | Select-Object -First 32 | ForEach-Object {
      @{adapter=Clip $_.Description 200;localIP=Clip ($_.IPAddress -join ', ') 2000;macAddress=Clip $_.MACAddress 100}
    }
  })
  $r.addressInfo=@{interfaces=$interfaces}
  if(!$Test) {
    $publicPath=Join-Path $store 'public-ip.json'
    $public=TryValue {Get-Content $publicPath -Raw | ConvertFrom-Json}
    $checked=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    if(!$public -or $public.schema -ne 2 -or $checked-$public.checkedAt -ge 900000) {
      $public=@{schema=2;checkedAt=$checked;publicIPv4='';publicIPv6=''}
      $v4=TryValue {Invoke-RestMethod -Uri 'https://api.ipify.org?format=json' -TimeoutSec 5}
      $public.publicIPv4=ParsePublicIP $v4.ip 'InterNetwork'
      $v6=TryValue {Invoke-RestMethod -Uri 'https://api6.ipify.org?format=json' -TimeoutSec 5}
      $public.publicIPv6=ParsePublicIP $v6.ip 'InterNetworkV6'
      $public | ConvertTo-Json | Set-Content $publicPath
    }
    $r.addressInfo.publicIPv4=[string]$public.publicIPv4
    $r.addressInfo.publicIPv6=[string]$public.publicIPv6
    $r.addressInfo.checkedAt=$public.checkedAt
  }
  return $r
}
try {
  if ($Test) {
    if((ParsePublicIP '203.0.113.5' 'InterNetwork') -ne '203.0.113.5' -or
       (ParsePublicIP '2001:db8::1' 'InterNetworkV6') -ne '2001:db8::1' -or
       (ParsePublicIP '203.0.113.5' 'InterNetworkV6') -ne '' -or
       (ParsePublicIP '2001:db8::1' 'InterNetwork') -ne '' -or
       (ParsePublicIP 'invalid' 'InterNetwork') -ne '' -or
       (ParsePublicIP $null 'InterNetworkV6') -ne '') {throw 'Public IP family validation failed'}
    $r=GetReading
    if ($r.memory -lt 0 -or $r.memory -gt 100 -or !$r.hostname -or !$r.inventory.os -or !$r.disks.Count -or !$r.addressInfo.interfaces.Count) {throw 'Collector validation failed'}
    Write-Output 'Collector passed: hardware, memory, CPU, storage and inventory read. No data uploaded.'
    exit 0
  }
  $stage='locking collector'
  try {$runLock=[IO.File]::Open((Join-Path $store 'collector.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)} catch {exit 0}
  $stage='reading configuration'
  $config=Get-Content (Join-Path $store 'config.json') -Raw | ConvertFrom-Json
  $stage='reading saved credentials (if unreadable, re-enrol once)'
  $secret=ReadDeviceCredential $store
  $stage='refreshing Firebase login'
  $token=Invoke-RestMethod -Method Post -Uri ('https://securetoken.googleapis.com/v1/token?key='+$config.apiKey) -ContentType 'application/x-www-form-urlencoded' -Body @{grant_type='refresh_token';refresh_token=$secret} -TimeoutSec 15
  if($token.user_id -ne $config.deviceId) {throw 'Device identity mismatch'}
  $stage='saving refreshed credentials'
  if(!$token.refresh_token) {throw 'Missing refresh token'}
  SaveDeviceCredential $store $token.refresh_token
  $stage='checking device access'
  $base='https://ticketing-a8461-default-rtdb.asia-southeast1.firebasedatabase.app'
  $suffix='?auth='+[Uri]::EscapeDataString($token.id_token)
  $device=Invoke-RestMethod -Uri ($base+'/monitoringDevices/'+$config.deviceId+'.json'+$suffix) -TimeoutSec 15
  if (!$device.active) {'Monitoring stopped: device is inactive or deleted.' | Set-Content (Join-Path $store 'status.txt');exit 0}
  $stage='collecting hardware'
  $r=GetReading
  $cachePath=Join-Path $store 'network.json'
  $network=TryValue {Get-Content $cachePath -Raw | ConvertFrom-Json}
  if($device.speedTests -and (!$network -or $r.at-$network.at -ge 3600000)) {
    $network=@{at=$r.at}
    Add-Type -AssemblyName System.Net.Http
    $web=New-Object Net.Http.HttpClient
    $web.Timeout=[TimeSpan]::FromSeconds(5)
    try {
      # Bounded, optional sample. No files or user content are uploaded.
      $watch=[Diagnostics.Stopwatch]::StartNew()
      $bytes=$web.GetByteArrayAsync('https://speed.cloudflare.com/__down?bytes=1000000').GetAwaiter().GetResult()
      $watch.Stop();$network.downloadMbps=[Math]::Round($bytes.Length*8/[Math]::Max(.001,$watch.Elapsed.TotalSeconds)/1000000,2)
      $watch.Restart();$content=New-Object Net.Http.ByteArrayContent -ArgumentList (,(New-Object byte[] 250000))
      $response=$web.PostAsync('https://speed.cloudflare.com/__up',$content).GetAwaiter().GetResult()
      $response.EnsureSuccessStatusCode() | Out-Null
      $response.Dispose();$content.Dispose()
      $watch.Stop();$network.uploadMbps=[Math]::Round(250000*8/[Math]::Max(.001,$watch.Elapsed.TotalSeconds)/1000000,2)
    } catch {} finally {$web.Dispose()}
    $network | ConvertTo-Json | Set-Content $cachePath
  }
  if($network) {$r.network=$network}
  $r.at=@{'.sv'='timestamp'}
  $inventorySentPath=Join-Path $store 'inventory-sent.txt'
  $inventoryAt=$r.inventory.at
  $sent=TryValue {Get-Content $inventorySentPath -Raw}
  if($sent -and $sent.Trim() -eq [string]$inventoryAt) {$r.Remove('inventory')}
  if(!$r.ContainsKey('pingMs')) {$r.pingMs=$null}
  $body=$r | ConvertTo-Json -Depth 8 -Compress
  $stage='uploading current readings'
  $null=Invoke-RestMethod -Method Patch -Uri ($base+'/monitoringCurrent/'+$config.deviceId+'.json'+$suffix) -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 15
  [string]$inventoryAt | Set-Content $inventorySentPath
  $bucket=[long][Math]::Floor([DateTimeOffset]::UtcNow.ToUnixTimeSeconds()/300)
  $historyPath=Join-Path $store 'history-slot.txt'
  $last=TryValue {Get-Content $historyPath -Raw}
  if(!$last -or $last.Trim() -ne [string]$bucket) {
    $sample=@{at=@{'.sv'='timestamp'};cpu=$r.cpu;memory=$r.memory}
    $stage='uploading history'
    $null=Invoke-RestMethod -Method Put -Uri ($base+'/monitoringHistory/'+$config.deviceId+'/'+($bucket%288)+'.json'+$suffix) -ContentType 'application/json' -Body ($sample | ConvertTo-Json -Depth 4 -Compress) -TimeoutSec 15
    [string]$bucket | Set-Content $historyPath
  }
  'Last successful upload: '+[DateTime]::UtcNow.ToString('o') | Set-Content (Join-Path $store 'status.txt')
} catch {
  # Do not write tokens, request URLs, device details or passwords to diagnostics.
  if (!$Test -and (Test-Path $store)) {
    $http=''; if($_.Exception.Response) {$http=[string][int]$_.Exception.Response.StatusCode}
    ('Last attempt failed at '+[DateTime]::UtcNow.ToString('o')+'. Stage: '+$stage+'. Type: '+$_.Exception.GetType().Name+'. HTTP: '+$http) | Set-Content (Join-Path $store 'status.txt')
  }
  if($Test) {Write-Error $_}
  exit 1
} finally {
  if($runLock) {$runLock.Dispose()}
}

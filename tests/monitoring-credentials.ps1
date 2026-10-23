$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../desktop/monitoring/Credentials.ps1')
$folder=Join-Path $env:TEMP ('mt-credentials-test-'+[Guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory $folder
function Assert($ok,$message) {if(!$ok) {throw $message}}
try {
  $primary=Join-Path $folder 'credentials.dat'
  $backup=Join-Path $folder 'credentials.backup.dat'
  # Legacy credentials are accepted.
  [IO.File]::WriteAllText($primary,(ProtectText 'legacy-test-token'))
  Assert ((ReadDeviceCredential $folder) -ceq 'legacy-test-token') 'Legacy migration failed'
  SaveDeviceCredential $folder 'refreshed-test-token'
  Assert ((ReadDeviceCredential $folder) -ceq 'refreshed-test-token') 'Save failed'
  Assert ((UnprotectText ([IO.File]::ReadAllText($backup))) -ceq 'refreshed-test-token') 'Backup missing'
  Assert (![IO.File]::ReadAllText($primary).Contains('refreshed-test-token')) 'Token stored in plaintext'
  # A corrupt/truncated primary recovers automatically, without an enrollment JSON.
  [IO.File]::WriteAllText($primary,'truncated!')
  Assert ((ReadDeviceCredential $folder) -ceq 'refreshed-test-token') 'Corruption recovery failed'
  SaveDeviceCredential $folder 'recovered-test-token'
  Remove-Item $primary
  Assert ((ReadDeviceCredential $folder) -ceq 'recovered-test-token') 'Missing primary recovery failed'
  SaveDeviceCredential $folder 'stable-test-token'
  # Encryption/validation failure cannot truncate the working primary or backup.
  $before=[IO.File]::ReadAllText($primary)
  $rejected=$false
  try {SaveDeviceCredential $folder ''} catch {$rejected=$true}
  Assert $rejected 'Empty credentials accepted'
  Assert ([IO.File]::ReadAllText($primary) -ceq $before) 'Failed save changed primary'
  # Simulate interruption before atomic replace: abandoned partial temporary file is ignored.
  [IO.File]::WriteAllText(($primary+'.interrupted.tmp'),'partial')
  Assert ((ReadDeviceCredential $folder) -ceq 'stable-test-token') 'Partial write used'
  # Simulate interruption between committing backup and primary.
  WriteAtomicText $backup (ProtectText 'new-test-token')
  Assert ((ReadDeviceCredential $folder) -ceq 'stable-test-token') 'Primary changed before commit'
  [IO.File]::WriteAllText($primary,'')
  Assert ((ReadDeviceCredential $folder) -ceq 'new-test-token') 'New backup recovery failed'
  [IO.File]::WriteAllText($backup,'broken')
  $rejected=$false
  try {$null=ReadDeviceCredential $folder} catch {$rejected=$_.Exception.Message.StartsWith('MONITORING_CREDENTIAL_UNREADABLE')}
  Assert $rejected 'Unrecoverable credentials not diagnosed'
  Write-Output 'Credential persistence tests passed: legacy, encryption, corruption, missing primary, failed save and interrupted writes.'
} finally {Remove-Item $folder -Recurse -Force}

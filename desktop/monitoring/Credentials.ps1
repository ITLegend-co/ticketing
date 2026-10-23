# Credentials remain encrypted with Windows DPAPI and inside the admin/SYSTEM-only folder.
Add-Type -AssemblyName System.Security
function ProtectText([string]$text) {
  if([string]::IsNullOrWhiteSpace($text)) {throw 'Empty credential'}
  [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($text),$null,[Security.Cryptography.DataProtectionScope]::LocalMachine))
}
function UnprotectText([string]$text) {
  $plain=[Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($text),$null,[Security.Cryptography.DataProtectionScope]::LocalMachine))
  if([string]::IsNullOrWhiteSpace($plain)) {throw 'Empty credential'}
  return $plain
}
function WriteAtomicText([string]$path,[string]$text) {
  $temp=$path+'.'+[Guid]::NewGuid().ToString('N')+'.tmp'
  try {
    $bytes=[Text.Encoding]::UTF8.GetBytes($text)
    $stream=[IO.File]::Open($temp,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try {$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)} finally {$stream.Dispose()}
    if([IO.File]::Exists($path)) {[IO.File]::Replace($temp,$path,($temp+'.old'))} else {[IO.File]::Move($temp,$path)}
  } finally {
    if([IO.File]::Exists($temp)) {[IO.File]::Delete($temp)}
    if([IO.File]::Exists($temp+'.old')) {[IO.File]::Delete($temp+'.old')}
  }
}
function SaveDeviceCredential([string]$folder,[string]$token) {
  # Encrypt and verify BEFORE touching either saved copy. Never pipe encryption into Set-Content.
  $encrypted=ProtectText $token
  if((UnprotectText $encrypted) -cne $token) {throw 'Credential verification failed'}
  $primary=Join-Path $folder 'credentials.dat'
  # The backup receives the newly verified token first; a killed write leaves the primary intact.
  WriteAtomicText (Join-Path $folder 'credentials.backup.dat') $encrypted
  WriteAtomicText $primary $encrypted
}
function ReadDeviceCredential([string]$folder) {
  foreach($name in @('credentials.dat','credentials.backup.dat')) {
    try {
      $plain=UnprotectText ([IO.File]::ReadAllText((Join-Path $folder $name)))
      return $plain
    } catch {}
  }
  throw 'MONITORING_CREDENTIAL_UNREADABLE: Re-enrol this computer once using its enrollment file.'
}

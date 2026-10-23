$ErrorActionPreference='Stop'
# Run locally on the IT administrator's Windows PC. Requires JDK 17+ and GitHub CLI.
# This keeps the private key on your PC and sends it only to GitHub encrypted Actions secrets.
if(!(Get-Command keytool -ErrorAction SilentlyContinue) -or !(Get-Command gh -ErrorAction SilentlyContinue)) {throw 'Install JDK 17+ and GitHub CLI first, then run gh auth login.'}
$folder=Join-Path $env:USERPROFILE 'MountainTorqSigning'
$null=New-Item -ItemType Directory $folder -Force
$key=Join-Path $folder 'helpdesk-release.jks'
$secure=Read-Host 'Enter a strong signing password (keep it with your private key backup)' -AsSecureString
$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $env:MT_SIGNING_PASSWORD=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  if($env:MT_SIGNING_PASSWORD.Length -lt 12){throw 'Use at least 12 characters.'}
  if(!(Test-Path $key)) {
    & keytool -genkeypair -keystore $key -storetype JKS -alias helpdesk -keyalg RSA -keysize 3072 -validity 10000 -storepass:env MT_SIGNING_PASSWORD -keypass:env MT_SIGNING_PASSWORD -dname 'CN=Mountain Torq IT, O=Mountain Torq Sdn Bhd, C=MY'
    if($LASTEXITCODE -ne 0){throw 'Signing key creation failed'}
  }
  & keytool -list -keystore $key -alias helpdesk -storepass:env MT_SIGNING_PASSWORD | Out-Null
  if($LASTEXITCODE -ne 0){throw 'Signing password or alias does not match the existing key'}
  [Convert]::ToBase64String([IO.File]::ReadAllBytes($key)) | & gh secret set ANDROID_KEYSTORE_BASE64 --repo ITLegend-co/ticketing
  if($LASTEXITCODE -ne 0){throw 'Could not save signing key secret'}
  $env:MT_SIGNING_PASSWORD | & gh secret set ANDROID_KEYSTORE_PASSWORD --repo ITLegend-co/ticketing
  if($LASTEXITCODE -ne 0){throw 'Could not save signing password secret'}
  & gh workflow run android.yml --repo ITLegend-co/ticketing
  if($LASTEXITCODE -ne 0){throw 'Secrets saved; run Build Android APK from GitHub Actions manually'}
  Write-Host "Release build started. Keep a secure backup of $key and its password. Never commit or email them."
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  Remove-Item Env:MT_SIGNING_PASSWORD -ErrorAction SilentlyContinue
}

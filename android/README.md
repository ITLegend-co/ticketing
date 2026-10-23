# Android release setup

The app is a dedicated Android WebView client of the HTTPS helpdesk. It uses existing Firebase accounts and role rules; no Firebase configuration change is required. It does not provide mobile background push notifications.

## Build

Use JDK 17 and Gradle 8.11.1 with Android SDK platform/build-tools 35.
Run `gradle testReleaseUnitTest lintRelease assembleRelease` inside this directory.
The GitHub **Build Android APK** workflow also builds and tests it. Without signing secrets, it retains an unsigned build artifact only, and does not display a broken download link on the website.

## Publish an installable APK (once)

A repository administrator must configure these encrypted GitHub Actions repository secrets:
- `ANDROID_KEYSTORE_BASE64`: Base64 of the private release keystore.
- `ANDROID_KEYSTORE_PASSWORD`: Its password. The key alias must be `helpdesk`, with the same key password.

On your own Windows PC, install JDK 17+ and GitHub CLI, then run `gh auth login`. Download this repository, open PowerShell in the repository, and run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\android\configure-signing.ps1
```

The script generates the private key in your user profile's MountainTorqSigning folder, asks for a password, uploads the key and password through GitHub's encrypted secrets mechanism, and starts the release build. Keep a secure backup of the key and password. They are never committed or included in APK artifacts.

The workflow signs and verifies the APK, publishes its release, updates `public/mobile-release.json`, and deploys the Android download button. GitHub Pages uses the same existing deployment environment. Android releases use `--latest=false` so Windows update checks continue to find the Windows release.

After the first release, test sign-in, a ticket reply, image upload and a report export on a real Android phone before broad rollout.

## iPhone

Open the website in Safari, tap Install on iPhone / iPad for instructions, then Share > Add to Home Screen > Open as Web App (if shown) > Add. The installed web app requires internet. It does not install an APK.

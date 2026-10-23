export function installPlatform(userAgent: string, platform: string, touchPoints: number) {
  if (userAgent.includes("MountainTorqAndroid/")) return "installed";
  if (/iPad|iPhone|iPod/i.test(userAgent) || (platform === "MacIntel" && touchPoints > 1)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  if (/Windows/i.test(userAgent)) return "windows";
  return "other";
}
export function apkDownload(version: unknown) {
  return typeof version === "string" && /^1\.0\.\d+$/.test(version)
    ? "https://github.com/ITLegend-co/ticketing/releases/download/android-v" + version + "/Mountain-Torq-Helpdesk-" + version + ".apk"
    : null;
}

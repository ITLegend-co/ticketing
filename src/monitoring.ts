export const canViewMonitoring = (role: string) => ["IT Admin", "IT Technician", "Management"].includes(role);
export type Device = { name: string; location: string; department: string; active: boolean; createdAt: number; speedTests: boolean };
export type Reading = {
  at: number; hostname: string; user: string; cpu: number; memory: number; memoryGB: number;
  uptimeHours: number; pingMs?: number; rebootPending: boolean;
  disks: Array<{ name: string; totalGB: number; freeGB: number; usedPercent: number }>;
  addressInfo?: { publicIP?: string; publicIPv4?: string; publicIPv6?: string; checkedAt?: number; interfaces?: Array<{adapter: string; localIP: string; macAddress: string}> };
  network?: { downloadMbps?: number; uploadMbps?: number; at: number };
  inventory?: { manufacturer: string; model: string; serial: string; os: string; cpuModel: string; ip: string; diskHealth: string; temperatureC?: number; batteryHealth?: number; antivirus: string; adapters: string; software: string; at: number };
};
export const deviceOnline = (reading: Reading | undefined, now: number) => !!reading && now - reading.at < 180000;
export function deviceAlerts(reading: Reading | undefined, now: number) {
  if (!reading) return ["Awaiting first report"];
  if (!deviceOnline(reading, now)) return [now - reading.at >= 600000 ? "Offline for over 10 minutes" : "No recent heartbeat"];
  const alerts: string[] = [];
  if (reading.cpu >= 90) alerts.push("CPU above 90% (current sample)");
  if (reading.memory >= 90) alerts.push("RAM above 90% (current sample)");
  for (const d of reading.disks || []) if (d.usedPercent >= 90) alerts.push(d.name + " storage above 90%");
  if (reading.pingMs != null && reading.pingMs > 150) alerts.push("High latency");
  if (reading.rebootPending) alerts.push("Windows restart pending");
  if (reading.inventory?.diskHealth === "Warning") alerts.push("Disk health warning");
  if (reading.inventory?.batteryHealth != null && reading.inventory.batteryHealth < 60) alerts.push("Battery health below 60%");
  return alerts;
}

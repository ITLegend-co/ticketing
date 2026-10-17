import { useEffect, useState, type FormEvent } from "react";
import { deleteApp, initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, deleteUser, initializeAuth, inMemoryPersistence } from "firebase/auth";
import { get, onValue, ref, set, update } from "firebase/database";
import { auth, database, firebaseConfig, generateTemporaryPassword } from "./firebase";
import { canViewMonitoring, deviceAlerts, deviceOnline, type Device, type Reading } from "./monitoring";
import "./monitoring.css";

const time = (at?: number) => at ? new Date(at).toLocaleString() : "Not reported";
const number = (n?: number, suffix = "") => typeof n === "number" && Number.isFinite(n) ? n.toFixed(1) + suffix : "Unavailable";
function saveConfig(config: object) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(config, null, 2)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = "MT-device-enrollment.json"; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export default function DeviceMonitoring({ role }: { role: string }) {
  const [devices, setDevices] = useState<Record<string, Device>>({});
  const [readings, setReadings] = useState<Record<string, Reading>>({});
  const [history, setHistory] = useState<Reading[]>([]);
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [config, setConfig] = useState<object | null>(null);
  const canView = canViewMonitoring(role);
  useEffect(() => {
    if (!canView) return;
    const failure = () => { setError("Monitoring access is not ready. An IT Admin must publish the monitoring database rules before enrolling computers."); setLoading(false); };
    const a = onValue(ref(database, "monitoringDevices"), s => { setDevices(s.val() || {}); setLoading(false); setError(""); }, failure);
    const b = onValue(ref(database, "monitoringCurrent"), s => setReadings(s.val() || {}), failure);
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => { a(); b(); clearInterval(timer); };
  }, [canView]);
  useEffect(() => {
    setHistory([]);
    if (!selected || !canView) return;
    return onValue(ref(database, "monitoringHistory/" + selected), s => setHistory((Object.values(s.val() || {}) as Reading[]).sort((a,b) => a.at - b.at)), () => setError("Could not load device history."));
  }, [selected, canView]);
  if (!canView) return null;
  async function enroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || role !== "IT Admin" || !auth.currentUser) return;
    const data = new FormData(event.currentTarget), admin = auth.currentUser;
    setBusy(true); setError(""); setConfig(null);
    let app;
    try {
      const check = await get(ref(database, "users/" + admin.uid));
      if (check.val()?.role !== "IT Admin" || check.val()?.status !== "Active") throw new Error("An active IT Admin account is required.");
      const email = "device-" + crypto.randomUUID() + "@devices.mountaintorq.invalid";
      const password = generateTemporaryPassword();
      app = initializeApp(firebaseConfig, "device-" + crypto.randomUUID());
      const secondary = initializeAuth(app, { persistence: inMemoryPersistence });
      const credential = await createUserWithEmailAndPassword(secondary, email, password);
      const deviceId = credential.user.uid;
      try {
        if (auth.currentUser?.uid !== admin.uid) throw new Error("Administrator session changed.");
        await set(ref(database, "monitoringDevices/" + deviceId), {
          name: String(data.get("name")).trim(), location: String(data.get("location")).trim(),
          department: String(data.get("department")).trim(), active: true, speedTests: data.get("speed") === "on",
          createdAt: Date.now(), enrolledBy: admin.uid,
        });
      } catch (e) { await deleteUser(credential.user).catch(() => {}); throw e; }
      const file = { deviceId, email, password, apiKey: firebaseConfig.apiKey, databaseURL: firebaseConfig.databaseURL };
      setConfig(file); saveConfig(file);
    } catch (e) { setError(e instanceof Error ? e.message : "Device enrollment failed."); }
    finally { if (app) await deleteApp(app).catch(() => {}); setBusy(false); }
  }
  const list = Object.entries(devices).filter(([id,d]) => [d.name,d.location,d.department,readings[id]?.hostname].join(" ").toLowerCase().includes(search.toLowerCase()));
  const reading = readings[selected], device = devices[selected];
  const recent = history.filter(p => now - p.at < 86400000);
  const online = Object.entries(devices).filter(([id,d]) => d.active && deviceOnline(readings[id],now)).length;
  return <div className="monitoring">
    <div className="monitor-summary"><span><strong>{Object.keys(devices).length}</strong> enrolled</span><span><strong>{online}</strong> online</span><span><strong>{Object.entries(devices).filter(([id,d]) => d.active && readings[id] && deviceAlerts(readings[id],now).length).length}</strong> need attention</span></div>
    {error && <div className="auth-message error" role="alert">{error} {role === "IT Admin" && <a href={import.meta.env.BASE_URL + "monitoring-setup.html"} target="_blank" rel="noreferrer">Setup instructions</a>}</div>}
    <section className="panel monitor-panel">
      <div className="panel-heading"><h2>Company computers</h2><input aria-label="Search computers" placeholder="Name, location or department" value={search} onChange={e=>setSearch(e.target.value)}/></div>
      {loading ? <p>Loading devices…</p> : !list.length ? <div className="empty-state">No computers found. An IT Admin can enrol the first device below.</div> : <div className="table-scroll"><table><thead><tr><th>Computer</th><th>Location</th><th>Status</th><th>CPU</th><th>RAM</th><th>Last seen</th><th>Alerts</th></tr></thead><tbody>{list.map(([id,d])=><tr key={id}><td><button className="text-btn" onClick={()=>setSelected(id)}>{d.name}<small>{readings[id]?.hostname}</small></button></td><td>{d.location}<small>{d.department}</small></td><td>{!d.active ? "Revoked" : !readings[id] ? "Awaiting setup" : deviceOnline(readings[id],now) ? "Online" : "Offline"}</td><td>{deviceOnline(readings[id],now) ? number(readings[id]?.cpu,"%") : "—"}</td><td>{deviceOnline(readings[id],now) ? number(readings[id]?.memory,"%") : "—"}</td><td>{time(readings[id]?.at)}</td><td>{d.active ? deviceAlerts(readings[id],now).join("; ") || "None" : "Monitoring disabled"}</td></tr>)}</tbody></table></div>}
    </section>
    {device && <section className="panel monitor-panel">
      <div className="panel-heading"><h2>{device.name}</h2><button className="secondary-btn" onClick={()=>setSelected("")}>Close details</button></div>
      {reading ? <>
        <p>Last report: {time(reading.at)}. {deviceOnline(reading,now) ? "" : "These are the last known readings."}</p>
        <div className="monitor-details">
          {[["Signed-in Windows user",reading.user || "No interactive user"],["Windows",reading.inventory?.os],["Manufacturer / model",[reading.inventory?.manufacturer,reading.inventory?.model].filter(Boolean).join(" ")],["Serial",reading.inventory?.serial],["CPU",reading.inventory?.cpuModel],["RAM installed",number(reading.memoryGB," GB")],["Uptime",number(reading.uptimeHours," hours")],["Ping to 1.1.1.1",number(reading.pingMs," ms")],["Disk health",reading.inventory?.diskHealth],["Temperature (system sensor)",number(reading.inventory?.temperatureC," °C")],["Battery health",number(reading.inventory?.batteryHealth,"%")],["Antivirus",reading.inventory?.antivirus],["Network adapters",reading.inventory?.adapters],["Restart pending",reading.rebootPending ? "Yes" : "No"],["Inventory checked",time(reading.inventory?.at)]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value || "Unavailable"}</strong></div>)}
        </div>
        <h3>Network addresses</h3>
        <div className="monitor-details"><div><span>Public IPv4 Address</span><strong>{reading.addressInfo?.publicIPv4 || "Unavailable"}</strong></div><div><span>Public IPv6 Address</span><strong>{reading.addressInfo?.publicIPv6 || "Unavailable"}</strong></div><div><span>Public IP last checked</span><strong>{time(reading.addressInfo?.checkedAt)}</strong></div></div>
        <p className="monitor-muted">Public IPv4 and IPv6 are checked separately every 15 minutes from this computer’s internet connection. Unavailable means the address could not be obtained, including when that IP version is unsupported or the lookup is blocked. A VPN or shared office connection may affect the addresses shown.</p>
        {reading.addressInfo && reading.addressInfo.publicIPv4 === undefined && reading.addressInfo.publicIPv6 === undefined && <p className="monitor-muted">Update the Windows app and rerun device monitoring setup to check IPv4 and IPv6 separately.</p>}
        {reading.addressInfo ? <div className="table-scroll"><table><thead><tr><th>Network Adapter</th><th>Local IP Address</th><th>MAC Address</th></tr></thead><tbody>{(reading.addressInfo.interfaces || []).map((adapter,index)=><tr key={index}><td>{adapter.adapter || "Unknown adapter"}</td><td>{adapter.localIP || "Unavailable"}</td><td>{adapter.macAddress || "Unavailable"}</td></tr>)}</tbody></table>{!reading.addressInfo.interfaces?.length && <p>No active network adapters reported.</p>}</div> : <><div className="monitor-details"><div><span>Local IP Address</span><strong>{reading.inventory?.ip || "Unavailable"}</strong></div><div><span>MAC Address</span><strong>Unavailable</strong></div></div><p className="monitor-muted">Install the latest Windows app and run device monitoring setup again to report public IP and per-adapter MAC addresses.</p></>}
        <h3>Storage</h3>{(reading.disks || []).map(d=><p key={d.name}>{d.name}: {number(d.freeGB," GB")} free of {number(d.totalGB," GB")} · {number(d.usedPercent,"%")} used</p>)}
        <h3>Network transfer sample</h3><p>Download: {number(reading.network?.downloadMbps," Mbps")} · Upload: {number(reading.network?.uploadMbps," Mbps")} · {time(reading.network?.at)}</p><p className="monitor-muted">Optional small transfers estimate throughput; they are not a full broadband speed test. Ping may be unavailable when ICMP is blocked.</p>
        <h3>Last 24 hours</h3><p className="monitor-muted">Five-minute samples. Gaps indicate missing reports.</p>
        <div className="monitor-charts">{(["cpu","memory"] as const).map(metric=><div key={metric}><strong>{metric==="cpu" ? "CPU" : "RAM"} usage · 0–100%</strong>{recent.length ? <svg viewBox="0 0 600 120" role="img" aria-label={metric+" usage over the last 24 hours"}><line x1="0" x2="600" y1="110" y2="110" stroke="#cbd5e1"/>{recent.map(p=><circle key={p.at} cx={Math.max(0,600*(p.at-(now-86400000))/86400000)} cy={110-Math.min(100,Math.max(0,p[metric]))} r="2.5" fill={metric==="cpu" ? "#087e82":"#6751b9"}/>)}</svg> : <p>No history yet.</p>}</div>)}</div>
        <details><summary>Installed software (machine-wide)</summary><pre>{reading.inventory?.software || "Unavailable"}</pre></details>
      </> : <p>Awaiting the first report from this computer.</p>}
      {role==="IT Admin" && <div className="monitor-actions"><label><input type="checkbox" checked={!!device.speedTests} onChange={async e=>{try{await update(ref(database,"monitoringDevices/"+selected),{speedTests:e.target.checked});}catch{setError("Could not update speed-test setting.");}}}/> Enable hourly network transfer samples</label><button className="secondary-btn" onClick={async()=>{if(!confirm(device.active ? "Stop accepting monitoring reports from this computer?" : "Allow this device to report again?"))return;try{await update(ref(database,"monitoringDevices/"+selected),{active:!device.active});}catch{setError("Could not change device access.");}}}>{device.active ? "Revoke monitoring access" : "Restore monitoring access"}</button></div>}
    </section>}
    {role==="IT Admin" && <section className="panel monitor-panel"><h2>Enrol a computer</h2><p>Create one device file per computer. In the Windows app, right-click the tray icon → Set up device monitoring, then select the file. Windows administrator permission is required.</p>
      <form className="monitor-enroll" onSubmit={enroll}><label>Computer label<input name="name" required maxLength={100} placeholder="KK Office — Accounts PC"/></label><label>Location<input name="location" required maxLength={80} placeholder="KK / KP / PH"/></label><label>Department<input name="department" required maxLength={80}/></label><label><input name="speed" type="checkbox"/> Enable hourly transfer samples</label><button className="primary-btn" disabled={busy || !!error}>{busy ? "Enrolling…" : "Create device & download setup file"}</button></form>
      {config && <p role="status">Device created. Keep its setup file private; it contains that device’s credentials. Delete the file after installation. <button className="text-btn" onClick={()=>saveConfig(config)}>Download again</button></p>}
      <p><a href={import.meta.env.BASE_URL+"monitoring-setup.html"} target="_blank" rel="noreferrer">Monitoring setup and removal instructions</a></p>
    </section>}
    <p className="monitor-muted">Monitoring runs separately from ticketing. No monitoring emails are sent. Unsupported hardware readings appear as Unavailable.</p>
  </div>;
}

import {useEffect, useState} from "react";
import {Download, Smartphone} from "lucide-react";
import {installPlatform, apkDownload} from "./install-platform";
import "./mobile.css";

export default function InstallApp() {
  const [instructions,setInstructions]=useState(false);
  const [apk,setApk]=useState<string|null>(null);
  const platform=installPlatform(navigator.userAgent,navigator.platform,navigator.maxTouchPoints);
  const standalone=window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & {standalone?:boolean}).standalone;
  useEffect(()=>{
    if(platform!=="android") return;
    const controller=new AbortController();
    fetch(import.meta.env.BASE_URL+"mobile-release.json",{cache:"no-store",signal:controller.signal})
      .then(r=>r.ok?r.json():null).then(data=>setApk(apkDownload(data?.version))).catch(()=>{});
    return ()=>controller.abort();
  },[platform]);
  if(window.mtDesktop || platform==="installed" || standalone) return null;
  return <section className="windows-download install-app" aria-label="Install helpdesk">
    {platform==="windows" ? <>
      <a className="secondary-btn" href="https://github.com/ITLegend-co/ticketing/releases/download/desktop-v1.0.15/Mountain-Torq-IT-Helpdesk-Setup-1.0.15.exe"><Download size={18}/>Download for Windows</a>
      <p>Windows 10/11 · Ticket update popups</p>
    </> : platform==="android" ? <>
      {apk ? <a className="primary-btn" href={apk}><Download size={18}/>Download Android APK</a> : <button className="secondary-btn" disabled>Android APK · Coming soon</button>}
      <p>{apk?"After downloading, open the APK and allow installation from your browser if Android asks.":"The Android release is being prepared. You can use the complete helpdesk in this browser now."}</p>
      <small>Android 8 or newer · Internet required</small>
    </> : <>
      <button className="secondary-btn" onClick={()=>setInstructions(v=>!v)} aria-expanded={instructions}><Smartphone size={18}/>{platform==="ios"?"Install on iPhone / iPad":"Install web app"}</button>
      <p>Keep Helpdesk on your Home Screen.</p>
    </>}
    {instructions && <div className="install-instructions">
      {platform==="ios"?<ol><li>Open this page in <strong>Safari</strong>.</li><li>Tap <strong>Share</strong> (you may need to open Safari’s menu first).</li><li>Choose <strong>Add to Home Screen</strong>.</li><li>Enable <strong>Open as Web App</strong> if shown, then tap <strong>Add</strong>.</li></ol>:<p>Open your browser menu and choose Install app or Add to Home Screen, if available.</p>}
      <small>Internet is required. Windows background monitoring and UPS popups remain Windows-only.</small>
    </div>}
  </section>;
}

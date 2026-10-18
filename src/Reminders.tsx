import { useEffect, useState, type FormEvent } from "react";
import { onValue, ref, update, serverTimestamp } from "firebase/database";
import { auth, database } from "./firebase";
import { reminderDays, defaultReminderDays, type ReminderSchedule, type ReminderAck } from "./reminders";
import "./reminders.css";
type Person = {name:string;email:string;department:string;status:string};
export default function Reminders({role}:{role:string}) {
 const [users,setUsers]=useState<Record<string,Person>>({});
 const [schedules,setSchedules]=useState<Record<string,ReminderSchedule>>({});
 const [acks,setAcks]=useState<Record<string,Record<string,Record<string,ReminderAck>>>>({});
 const [selected,setSelected]=useState<string[]>([]);
 const [days,setDays]=useState(defaultReminderDays);
 const [weekday,setWeekday]=useState("17:00");
 const [enabled,setEnabled]=useState(true);
 const [message,setMessage]=useState("Before you leave, please save your work, shut down your computer, and turn off your UPS.");
 const [error,setError]=useState("");const [notice,setNotice]=useState("");const [busy,setBusy]=useState(false);
 const [ready,setReady]=useState(false);const [search,setSearch]=useState("");
 useEffect(()=>{
  if(role!=="IT Admin")return;
  const fail=()=>{setError("Could not load reminders. Publish the latest reminder database rules and check your connection.");};
  const a=onValue(ref(database,"users"),s=>setUsers(s.val()||{}),fail);
  const b=onValue(ref(database,"reminderSchedules"),s=>{setSchedules(s.val()||{});setReady(true);},fail);
  const c=onValue(ref(database,"reminderAcks"),s=>setAcks(s.val()||{}),fail);
  return()=>{a();b();c();};
 },[role]);
 if(role!=="IT Admin")return null;
 const people=Object.entries(users).filter(([,p])=>p.status==="Active").sort((a,b)=>a[1].name.localeCompare(b[1].name));
 const visible=people.filter(([,p])=>[p.name,p.email,p.department].join(" ").toLowerCase().includes(search.toLowerCase()));
 const receipts=Object.entries(acks).flatMap(([uid,installs])=>Object.entries(installs).flatMap(([installation,dates])=>Object.entries(dates).map(([date,value])=>({...value,uid,installation,date})))).sort((a,b)=>b.acknowledgedAt-a.acknowledgedAt).slice(0,100);
 async function save(event:FormEvent) {
  event.preventDefault();if(busy||!ready||!auth.currentUser)return;
  if(!selected.length){setError("Select at least one user.");return;}
  if(enabled&&!Object.values(days).some(Boolean)){setError("Choose at least one reminder day.");return;}
  setBusy(true);setError("");setNotice("");
  try {
   const changes:Record<string,unknown>={};
   for(const uid of selected) {
    if(users[uid]?.status!=="Active")throw new Error("A selected user is no longer active. Select active users and retry.");
    changes["reminderSchedules/"+uid]={enabled,message:message.trim(),days,updatedAt:serverTimestamp(),updatedBy:auth.currentUser.uid};
   }
   await update(ref(database),changes);setNotice("Schedule saved for "+selected.length+" user(s). Their signed-in Windows apps will download it when online.");
  } catch(e){setError(e instanceof Error?e.message:"Could not save schedule.");}finally{setBusy(false);}
 }
 function edit(uid:string) {
  const s=schedules[uid];setSelected([uid]);setDays({...s.days});setWeekday(s.days.mon||"17:00");setEnabled(s.enabled);setMessage(s.message);setError("");setNotice("Editing "+(users[uid]?.name||"user"));
 }
 return <div className="ups-admin">
  <section className="panel ups-intro"><img src={import.meta.env.BASE_URL+"reminder-cat.svg"} alt="Animated reminder cat"/><div><h2>Time to switch off the UPS</h2><p>Schedule a friendly desktop popup for staff. It appears at 60% of the screen width and height, even when the helpdesk window is closed to the tray.</p><p><strong>All times use Malaysia time (UTC+8).</strong> Requires the updated Windows app, signed in with the selected user’s account. A reminder applies to every PC signed in as that user.</p><a href={import.meta.env.BASE_URL+"reminder-setup.html"} target="_blank" rel="noreferrer">Setup and offline behaviour</a></div></section>
  {error&&<p role="alert" className="auth-message error">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <form className="panel ups-form" onSubmit={save}>
   <h2>Schedule reminders</h2><div className="ups-columns"><div><label>Find staff<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, email or department"/></label>
    <div className="ups-select-tools"><button type="button" className="text-btn" onClick={()=>setSelected(visible.map(([id])=>id))}>Select matching users</button><button type="button" className="text-btn" onClick={()=>setSelected([])}>Clear selection</button></div>
    <div className="ups-people">{visible.map(([id,p])=><label key={id}><input type="checkbox" checked={selected.includes(id)} onChange={e=>setSelected(v=>e.target.checked?[...v,id]:v.filter(x=>x!==id))}/><span><strong>{p.name}</strong><small>{p.department} · {p.email}</small></span></label>)}</div><p>{selected.length} selected</p></div>
   <div><label className="ups-check"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Reminders enabled</label>
    <label>Monday–Friday time<input type="time" value={weekday} onChange={e=>{setWeekday(e.target.value);setDays(v=>({...v,mon:e.target.value,tue:e.target.value,wed:e.target.value,thu:e.target.value,fri:e.target.value}));}}/></label>
    <div className="ups-times">{["sat","sun"].map(day=><label key={day}>{day==="sat"?"Saturday":"Sunday"}<input type="time" value={days[day as "sat"|"sun"]} onChange={e=>setDays(v=>({...v,[day]:e.target.value}))}/><button className="text-btn" type="button" onClick={()=>setDays(v=>({...v,[day]:""}))}>Disable day</button></label>)}</div>
    <details><summary>Different times for individual weekdays</summary><div className="ups-times">{reminderDays.slice(0,5).map(day=><label key={day}>{day.toUpperCase()}<input type="time" value={days[day]} onChange={e=>setDays(v=>({...v,[day]:e.target.value}))}/><button className="text-btn" type="button" onClick={()=>setDays(v=>({...v,[day]:""}))}>Disable day</button></label>)}</div></details>
    <label>Popup message<textarea required maxLength={500} rows={3} value={message} onChange={e=>setMessage(e.target.value)}/></label>
    <button className="primary-btn" disabled={busy||!ready||!selected.length}>{busy?"Saving…":"Save for selected users"}</button>
   </div></div>
  </form>
  <section className="panel ups-form"><h2>Saved schedules</h2><div className="table-scroll"><table><thead><tr><th>User</th><th>Status</th><th>Times (Malaysia)</th><th>Action</th></tr></thead><tbody>{Object.entries(schedules).map(([uid,s])=><tr key={uid}><td>{users[uid]?.name||"Removed user"}</td><td>{s.enabled?"Enabled":"Disabled"}</td><td>{reminderDays.map(d=>s.days[d]?d.toUpperCase()+" "+s.days[d]:null).filter(Boolean).join(" · ")||"No days"}</td><td><button className="text-btn" onClick={()=>edit(uid)}>Edit</button></td></tr>)}</tbody></table></div></section>
  <section className="panel ups-form"><h2>Recent acknowledgments</h2><p>These record the acknowledgment click, not confirmation that the UPS was turned off. Offline clicks appear after reconnecting. No entry means no acknowledgment has been received.</p><div className="table-scroll"><table><thead><tr><th>User</th><th>Computer</th><th>Scheduled</th><th>Acknowledged (Malaysia)</th></tr></thead><tbody>{receipts.map(a=><tr key={a.uid+a.installation+a.date}><td>{users[a.uid]?.name||"Removed user"}</td><td>{a.hostname}</td><td>{a.date} {a.scheduledFor}</td><td>{new Date(a.acknowledgedAt).toLocaleString("en-MY",{timeZone:"Asia/Kuala_Lumpur"})}</td></tr>)}</tbody></table>{!receipts.length&&<p>No acknowledgments received yet.</p>}</div></section>
 </div>;
}

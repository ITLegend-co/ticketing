import { useEffect, useState } from "react";
import { listQueued } from "./outbox-store";
import type { QueuedTicket } from "./outbox-core";
export default function SavedRequests({ uid, restore }: { uid: string; restore: (entry: QueuedTicket) => void }) {
  const [rows,setRows]=useState<QueuedTicket[]>([]);
  useEffect(()=>{let stopped=false;const refresh=()=>{void listQueued(uid).then(rows=>{if(!stopped)setRows(rows)}).catch(()=>{});};refresh();window.addEventListener("mt-outbox",refresh);return()=>{stopped=true;window.removeEventListener("mt-outbox",refresh);};},[uid]);
  if(!rows.length)return null;
  return <section className="outbox"><h3>Previously saved requests</h3><p>Automatic sending has been turned off. Reopen a saved request to submit it while connected. Already delivered tickets will be checked first.</p>{rows.map(row=><div key={row.id}><strong>{row.ticket.subject}</strong> <button className="secondary-btn" onClick={()=>restore(row)}>Reopen request</button></div>)}</section>;
}

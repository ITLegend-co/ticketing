import { useState } from "react";
import { reportTickets, type ReportTicket } from "./report-data";
export default function ReportDownload({ tickets, disabled }: { tickets: ReportTicket[]; disabled: boolean }) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur", year:"numeric",month:"2-digit",day:"2-digit" }).format(new Date());
  const [open,setOpen]=useState(false);
  const [start,setStart]=useState(today.slice(0,8)+"01");
  const [end,setEnd]=useState(today);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const valid=!!start && !!end && start<=end;
  const matched=valid?reportTickets(tickets,start,end):[];
  async function generate(format:"pdf"|"xlsx") {
    if(busy || !valid || !matched.length)return;
    setBusy(true);setMessage("Preparing report…");
    try {
      const {exportReport}=await import("./ticket-report");
      const warnings=await exportReport(matched,start,end,format,setMessage);
      setMessage(warnings?`Report downloaded. Photos could not be fully loaded for ${warnings} ticket(s); these are marked in the report.`:"Report downloaded.");
    }catch(error){setMessage(error instanceof Error?error.message:"Could not create report. Please try again.");}
    finally{setBusy(false);}
  }
  return <><button className="secondary-btn" disabled={disabled} onClick={()=>{setOpen(true);setMessage("");}}>Download report</button>
    {open && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Download ticket report"><button className="modal-backdrop" disabled={busy} onClick={()=>setOpen(false)} aria-label="Close report"/>
      <div className="ticket-modal"><div className="modal-heading"><div><h2>Download ticket report</h2><p>Choose a date range and file format.</p></div><button className="secondary-btn" disabled={busy} onClick={()=>setOpen(false)}>Close</button></div>
      <div className="form-body"><label>From<input type="date" value={start} max={end || undefined} disabled={busy} onChange={e=>setStart(e.target.value)}/></label><label>To<input type="date" value={end} min={start || undefined} disabled={busy} onChange={e=>setEnd(e.target.value)}/></label>
      <p className="full">Includes tickets created on these dates, in Malaysia time. Reports show current details and all attached photos. Only tickets you can access are included; queue search and filters do not apply.</p>
      <p className="full">{valid?`${matched.length} tickets in this period.`:"Choose a valid date range."}</p>
      <p className="full" role="status">{message}</p></div>
      <div className="modal-actions"><button className="secondary-btn" disabled={busy||!matched.length||disabled} onClick={()=>generate("xlsx")}>Download Excel</button><button className="primary-btn" disabled={busy||!matched.length||disabled} onClick={()=>generate("pdf")}>Download PDF</button></div></div></div>}
  </>;
}

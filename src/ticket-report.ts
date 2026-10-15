import { displayName } from "./display-name";
import { driveReady, driveRequest, type DrivePhoto } from "./drive";
import { reportDate, type ReportTicket } from "./report-data";
type Photo = { data: string; width: number; height: number; name: string };
type Entry = { ticket: ReportTicket; photos: Photo[]; warning: string };
async function thumbnail(data: string, name: string): Promise<Photo> {
  const img = new Image(); img.src = data;
  await img.decode();
  const scale = Math.min(1, 480 / img.width, 320 / img.height);
  const canvas = document.createElement("canvas"); canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d")!; ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { data: canvas.toDataURL("image/jpeg", 0.85), width: canvas.width, height: canvas.height, name };
}
const details = (t: ReportTicket) => `${t.subject}\n${t.description}\nCategory: ${t.category}\nLocation: ${t.location}\nImpact: ${t.impact}`;
const replies = (t: ReportTicket) => Object.values(t.updates || {}).sort((a,b)=>a.createdAt-b.createdAt).map(n=>`${reportDate(n.createdAt)} · ${displayName(n.author)}\n${n.text}`).join("\n\n") || "No replies";
const headers = ["Ticket / created", "Request details", "Requester", "Status / priority", "Assigned to", "Replies", "Photos"];
const values = (t: ReportTicket) => [`${t.id}\n${reportDate(t.createdAt)}`, details(t), `${displayName(t.requester)}\n${t.department}`, `${t.status}\n${t.priority}`, displayName(t.technician) || "Unassigned", replies(t)];
function download(data: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(()=>URL.revokeObjectURL(url), 60000);
}
export async function exportReport(tickets: ReportTicket[], start: string, end: string, format: "pdf" | "xlsx", progress: (s: string)=>void) {
  const entries: Entry[] = [];
  for (const [i, ticket] of tickets.entries()) {
    progress(`Loading photos: ticket ${i + 1} of ${tickets.length}…`);
    const entry: Entry = { ticket, photos: [], warning: "" };
    if (!driveReady) entry.warning = "Photo service unavailable";
    else try {
      const { files } = await driveRequest<{ files: DrivePhoto[] }>(ticket.id, "list");
      for (const photo of files) {
        try {
          const { file } = await driveRequest<{ file: DrivePhoto & { base64: string } }>(ticket.id, "download", { fileId: photo.id });
          entry.photos.push(await thumbnail(`data:${file.mime};base64,${file.base64}`, photo.name));
        } catch { entry.warning += `Photo unavailable: ${photo.name}\n`; }
      }
    } catch { entry.warning = "Could not load attached photos"; }
    entries.push(entry);
  }
  progress("Creating report…");
  const title = "Mountain Torq · IT Support Report";
  const summary = `${start} to ${end} · Created date (Malaysia time) · ${tickets.length} tickets`;
  const counts = [...new Set(tickets.map(t=>t.status))].map(status=>`${status}: ${tickets.filter(t=>t.status===status).length}`).join(" · ");
  const filename = `IT-Support-Report_${start}_to_${end}`;
  if (format === "xlsx") {
    const { default: ExcelJS } = await import("exceljs");
    const book = new ExcelJS.Workbook(); book.creator = "Mountain Torq IT Helpdesk";
    const sheet = book.addWorksheet("Tickets", { views: [{ state: "frozen", ySplit: 5 }], pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    [title, summary, counts, `Generated: ${reportDate(Date.now())} · Current ticket state`].forEach((text,i)=>{sheet.mergeCells(i+1,1,i+1,7); sheet.getCell(i+1,1).value=text;});
    sheet.getCell("A1").font = { bold: true, size: 16 };
    sheet.addRow(headers); sheet.autoFilter = "A5:G5";
    [27,55,26,20,24,60,38].forEach((width,i)=>sheet.getColumn(i+1).width=width);
    sheet.getRow(5).eachCell(cell=>{cell.font={bold:true,color:{argb:"FFFFFFFF"}};cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF174C46"}};});
    for (const entry of entries) {
      // Separate photo rows keep every image within Excel's maximum row height.
      if(entry.warning && entry.photos.length) sheet.addRow([entry.ticket.id,entry.warning]);
      const chunks = Math.max(1,entry.photos.length);
      for (let i=0;i<chunks;i++) {
        const row=sheet.addRow([... (i===0?values(entry.ticket).map(v=>v.length>30000?v.slice(0,29950)+"\n[Continued in Full details]":v):[`${entry.ticket.id} (photo ${i+1})`,"","","","",""]), i===0 && !entry.photos[i]?(entry.warning || "No photos"):""]);
        row.height=entry.photos[i]?132:90;
        row.eachCell({includeEmpty:true},cell=>{cell.alignment={vertical:"top",wrapText:true};cell.border={bottom:{style:"thin",color:{argb:"FFDDE5E3"}}};});
        const photo=entry.photos[i];
        if(photo) {
          const ratio=Math.min(245/photo.width,145/photo.height);
          const id=book.addImage({base64:photo.data,extension:"jpeg"});
          sheet.addImage(id,{tl:{col:6.1,row:row.number-1+0.12},ext:{width:photo.width*ratio,height:photo.height*ratio},editAs:"oneCell"});
        }
      }
    }
    // Full text remains available even when long ticket rows exceed the display height.
    const textSheet=book.addWorksheet("Full details"); textSheet.columns=[{header:"Ticket",key:"id",width:28},{header:"Section",key:"section",width:20},{header:"Text",key:"text",width:110}];
    for(const t of tickets) for(const [section,text] of [["Description",details(t)],["Replies",replies(t)]]) {
      for(let i=0;i<text.length;i+=30000) textSheet.addRow({id:t.id,section,text:text.slice(i,i+30000)});
    }
    textSheet.getColumn(3).alignment={wrapText:true,vertical:"top"};
    download(await book.xlsx.writeBuffer() as BlobPart,`${filename}.xlsx`,"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  } else {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const doc = new jsPDF({orientation:"landscape",unit:"mm",format:"a4"});
    doc.setFontSize(16); doc.text(title.replace("·","-"),10,14); doc.setFontSize(9); doc.text(summary,10,21); doc.text(counts,10,27);
    const body: any[]=[];
    const photoRows=new Map<number,Photo>();
    for(const entry of entries) {
      const row = [...values(entry.ticket),entry.photos.length ? "" : (entry.warning || "No photos")];
      if(entry.warning && entry.photos.length) row[5] += "\n" + entry.warning;
      if(entry.photos[0]) photoRows.set(body.length,entry.photos[0]);
      body.push(row);
      for(const photo of entry.photos.slice(1)) { photoRows.set(body.length,photo); body.push([`${entry.ticket.id}\n${photo.name}`,"","","",""," "]); }
    }
    const drawnPhotos=new Set<number>();
    autoTable(doc,{head:[headers],body,startY:32,rowPageBreak:"avoid",margin:{left:10,right:10,bottom:14},styles:{fontSize:8,cellPadding:2,overflow:"linebreak"},headStyles:{fillColor:[23,76,70]},columnStyles:{0:{cellWidth:30},1:{cellWidth:59},2:{cellWidth:30},3:{cellWidth:25},4:{cellWidth:28},5:{cellWidth:59},6:{cellWidth:46}},
      didParseCell(data){if(data.section==="body" && photoRows.has(data.row.index)) data.cell.styles.minCellHeight=36;},
      didDrawCell(data){const photo=photoRows.get(data.row.index);if(data.section==="body" && data.column.index===6 && photo && !drawnPhotos.has(data.row.index)){drawnPhotos.add(data.row.index);const scale=Math.min(42/photo.width,32/photo.height);doc.addImage(photo.data,"JPEG",data.cell.x+2,data.cell.y+2,photo.width*scale,photo.height*scale);}},
    });
    for(let p=1;p<=doc.getNumberOfPages();p++){doc.setPage(p);doc.setFontSize(8);doc.text(`Generated ${reportDate(Date.now())} | Current ticket state | Page ${p} of ${doc.getNumberOfPages()}`,10,203);}
    doc.save(`${filename}.pdf`);
  }
  return entries.filter(e=>e.warning).length;
}

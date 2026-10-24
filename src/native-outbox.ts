import type { QueuedTicket } from "./outbox-core";
type Bridge = { postMessage: (message: string) => void; onmessage?: (event: { data: string }) => void };
type Reply = { done?: boolean; saved?: boolean; pending?: number; message?: string; missing?: boolean };
const bridge = () => (window as unknown as { MTOutbox?: Bridge }).MTOutbox;
export const hasNativeOutbox = () => !!bridge();
const pending = new Map<string, { resolve: (value: Reply) => void; reject: (error: Error) => void; timer: number }>();
export function nativeRequest(payload: object): Promise<Reply> {
  const api=bridge();if(!api)return Promise.reject(new Error("Background uploader unavailable."));
  api.onmessage=event=>{
    const reply=JSON.parse(event.data);const item=pending.get(reply.requestId);if(!item)return;
    clearTimeout(item.timer);pending.delete(reply.requestId);
    if(reply.ok)item.resolve(reply.result);else item.reject(new Error("Background uploader could not save this request. It remains in your outbox."));
  };
  return new Promise((resolve,reject)=>{
    const requestId=crypto.randomUUID();const timer=window.setTimeout(()=>{pending.delete(requestId);reject(new Error("Background save not yet confirmed. Keep the app open to retry."));},90000);
    pending.set(requestId,{resolve,reject,timer});api.postMessage(JSON.stringify({...payload,requestId}));
  });
}
export const nativeSession = (uid: string, refreshToken = "") => nativeRequest({ action: "session", uid, refreshToken });
async function encode(file: File): Promise<string> {
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=()=>reject(new Error("Could not read queued photo."));reader.readAsDataURL(file);});
}
export async function nativeEnqueue(entry: QueuedTicket) {
  const existing=await nativeRequest({action:"status",uid:entry.uid,id:entry.id});
  if(!existing.missing)return existing;
  const photos=await Promise.all(entry.photos.map(async p=>({id:p.id,name:p.file.name,type:p.file.type,sent:!!p.sent,...(!p.sent?{base64:await encode(p.file)}:{})})));
  return nativeRequest({ action:"enqueue", uid:entry.uid,id:entry.id,entry:{...entry,photos} });
}

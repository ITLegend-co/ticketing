import { hasNativeOutbox, nativeSession, nativeEnqueue } from "./native-outbox";
import { useEffect, useState } from "react";
import { auth, firebaseConfig } from "./firebase";
import { driveRequest, uploadPhoto, wakeTicketNotifications } from "./drive";
import { createOnce, deliver } from "./outbox-core";
import type { QueuedTicket } from "./outbox-core";
import { listQueued, removeQueued, saveQueued } from "./outbox-store";

export default function Outbox({ uid }: { uid: string }) {
  const [rows, setRows] = useState<QueuedTicket[]>([]);
  const [online, setOnline] = useState(navigator.onLine);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let stopped = false, running = false;
    const active = () => !stopped && navigator.onLine && auth.currentUser?.uid === uid;
    const refresh = async () => { const items = await listQueued(uid); if (!stopped) setRows(items); };
    async function flush() {
      if (running || stopped || auth.currentUser?.uid !== uid || (!navigator.onLine && !hasNativeOutbox())) return;
      running = true;
      try {
        if (hasNativeOutbox()) {
          const account=auth.currentUser;
          if(!account || account.uid!==uid)return;
          await nativeSession(uid,account.refreshToken);
          for(const entry of await listQueued(uid)) {
            if(stopped || auth.currentUser?.uid!==uid)break;
            const status=await nativeEnqueue(entry);
            if(status.done){await removeQueued(entry.id);if(!stopped)setMessage(`Sent: ${entry.ticket.subject}`);}
            else {entry.message=status.message || "Saved for background upload";await saveQueued(entry);}
          }
          return;
        }
        // Web Locks serialize tabs and windows. Older browsers keep the queue safely
        // rather than risking concurrent photo delivery.
        if (!navigator.locks) { setMessage("Automatic sending is unavailable in this browser. Open the same browser in a current version to send saved requests."); return; }
        await navigator.locks.request("mt-helpdesk-outbox", { ifAvailable: true }, async lock => {
          if (!lock || !active()) return;
          for (const entry of await listQueued(uid)) {
            if (!active()) break;
            try {
              entry.message = "Sending…";
              await deliver(entry, {
                active, persist: saveQueued,
                create: async () => {
                  const current = auth.currentUser;
                  if (!current || current.uid !== uid) throw new Error("Sign in with the account that saved this request.");
                  const token = await current.getIdToken();
                  if (!active()) throw new Error("Waiting for your account and connection.");
                  // Refresh identity fields: the directory may change while a device is offline.
                  const suffix = `.json?auth=${encodeURIComponent(token)}`;
                  const response = await fetch(`${firebaseConfig.databaseURL}/users/${uid}${suffix}`, { signal: AbortSignal.timeout(25000) });
                  if (!response.ok) throw new Error("Account verification failed. Sign in again; your request is kept.");
                  const profile = await response.json();
                  if (profile?.status !== "Active") throw new Error("Account inactive. Contact IT; your request is kept.");
                  // Verify an earlier attempt through the existing owner-filtered read rule.
                  const params = new URLSearchParams({ auth: token, orderBy: JSON.stringify("requesterId"), equalTo: JSON.stringify(uid) });
                  const own = await fetch(`${firebaseConfig.databaseURL}/tickets.json?${params}`, { signal: AbortSignal.timeout(25000) });
                  if (!own.ok) throw new Error("Could not verify previous delivery. Your request is kept for retry.");
                  const previous = (await own.json())?.[entry.id];
                  if (previous) {
                    if (previous.requesterId !== uid || previous.createdAt !== entry.ticket.createdAt) throw new Error("Request ID conflict. Contact IT.");
                    return;
                  }
                  const ticket = { ...entry.ticket, requester: profile.name, department: profile.department };
                  if (!active()) throw new Error("Waiting for connection.");
                  await createOnce(`${firebaseConfig.databaseURL}/tickets/${entry.id}${suffix}`, ticket);
                  wakeTicketNotifications(entry.id);
                },
                upload: async photo => {
                  const capabilities = await driveRequest<{ resumableUploads?: boolean }>(entry.id, "list");
                  if (!capabilities.resumableUploads) throw new Error("Ticket sent. Photos are saved here until IT updates the attachment service for safe retries.");
                  if (!active()) throw new Error("Waiting for connection to upload photos.");
                  await uploadPhoto(entry.id, photo.file, photo.id);
                },
                complete: async () => { await removeQueued(entry.id); if (!stopped) setMessage(`Sent: ${entry.ticket.subject}`); },
              });
            } catch (error) {
              entry.message = error instanceof Error ? error.message : "Waiting to retry. Your request is saved.";
              await saveQueued(entry);
            }
          }
        });
      } catch (error) { if (!stopped) setMessage(error instanceof Error ? error.message : "Could not read saved requests."); }
      finally { running = false; await refresh().catch(() => {}); }
    }
    const changed = () => { void refresh().catch(error => setMessage(error.message)); };
    const reconnect = () => { setOnline(navigator.onLine); void flush(); };
    const visible = () => { if (document.visibilityState === "visible") void flush(); };
    window.addEventListener("mt-outbox", changed);
    window.addEventListener("mt-outbox-send", reconnect);
    window.addEventListener("online", reconnect);
    window.addEventListener("offline", reconnect);
    document.addEventListener("visibilitychange", visible);
    changed(); void flush();
    const timer = window.setInterval(flush, 30000);
    return () => { stopped = true; clearInterval(timer); window.removeEventListener("mt-outbox", changed); window.removeEventListener("mt-outbox-send", reconnect); window.removeEventListener("online", reconnect); window.removeEventListener("offline", reconnect); document.removeEventListener("visibilitychange", visible); };
  }, [uid]);
  if (online && !rows.length && !message) return null;
  return <section className="outbox" aria-label="Saved requests" aria-live="polite">
    {!online && <strong>Offline — new requests will be saved on this device.</strong>}
    {!!rows.length && <><h3>Outbox · {rows.length}</h3><p>{hasNativeOutbox() ? "Once saved for background upload, Android sends when connected even if you close the app. Sign-out pauses delivery. Android may delay work to save battery." : "Keep this app open to send when connected. If closed, reopen it and sign in with the same account."} Do not clear app or browser data while requests are waiting.</p>
      {rows.map(row => <div key={row.id}><strong>{row.ticket.subject}</strong><p>{row.message || "Saved on this device — waiting to send"} · {row.photos.filter(p => !p.sent).length} photo(s) pending</p></div>)}
      <button className="secondary-btn" onClick={() => window.dispatchEvent(new Event("mt-outbox-send"))}>Retry now</button></>}
    {message && <p>{message} <button className="secondary-btn" onClick={() => setMessage("")}>Dismiss</button></p>}
  </section>;
}


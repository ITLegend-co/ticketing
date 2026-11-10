import { useEffect, useState } from 'react';
import { auth } from './firebase';
import { driveRequest, uploadPhoto } from './drive';
import { pendingPhotos, forgetPhoto, type PendingPhoto } from './pending-photos';
export default function PendingPhotos({ uid, busy, onUploaded }: { uid: string; busy: boolean; onUploaded: () => void }) {
  const [rows, setRows] = useState<PendingPhoto[]>([]), [sending, setSending] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = () => { void pendingPhotos(uid).then(r => { if (active) setRows(r); }).catch(() => {}); };
    refresh(); window.addEventListener('mt-pending-photos', refresh);
    return () => { active = false; window.removeEventListener('mt-pending-photos', refresh); };
  }, [uid]);
  async function retry() {
    if (sending || busy) return;
    setSending(true); setError('');
    try {
      if (!navigator.onLine) throw new Error('No internet connection. Photos remain saved here.');
      for (const row of rows) {
        if (auth.currentUser?.uid !== uid) break;
        const capabilities = await driveRequest<{ resumableUploads?: boolean }>(row.ticketId, 'list');
        if (!capabilities.resumableUploads) throw new Error('IT must update the attachment service before photos can be retried safely.');
        if (auth.currentUser?.uid !== uid) break;
        await uploadPhoto(row.ticketId, row.file, row.id); await forgetPhoto(row.id); onUploaded();
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not upload. Photos remain saved.'); }
    finally { setSending(false); }
  }
  if (!rows.length) return null;
  return <section className="outbox" aria-label="Pending photos"><h3>Photos waiting to upload · {rows.length}</h3><p>Your ticket/reply is saved. These photos remain on this device, including after restarting. Retrying sends only the photos.</p>{rows.map(r => <p key={r.id}>#{r.ticketId.slice(-7)} · {r.file.name}</p>)}<button className="secondary-btn" disabled={busy || sending} onClick={retry}>{sending ? 'Uploading…' : 'Retry photos'}</button>{error && <p role="alert">{error}</p>}</section>;
}

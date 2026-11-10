export type PendingPhoto = { id: string; uid: string; ticketId: string; file: File };
const ids = new WeakMap<File, string>();
async function operation<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('mt-helpdesk-pending-photos', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('photos', { keyPath: 'id' });
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
  return new Promise((resolve, reject) => {
    const tx = db.transaction('photos', mode), r = action(tx.objectStore('photos'));
    tx.oncomplete = () => { db.close(); resolve(r.result); if (mode === 'readwrite') window.dispatchEvent(new Event('mt-pending-photos')); };
    tx.onerror = tx.onabort = () => { db.close(); reject(new Error('Could not preserve photos on this device. Keep this form open and retry.')); };
  });
}
export const pendingPhotos = (uid: string) => operation<PendingPhoto[]>('readonly', s => s.getAll()).then(rows => rows.filter(r => r.uid === uid));
export const forgetPhoto = (id: string) => operation('readwrite', s => s.delete(id));
export async function retainPhotos(uid: string, ticketId: string, files: readonly File[], preferredId: (file: File) => string | undefined = () => undefined) {
  for (const file of files) {
    const id = ids.get(file) || preferredId(file) || crypto.randomUUID(); ids.set(file, id);
    await operation('readwrite', s => s.put({ id, uid, ticketId, file }));
  }
}
export async function sendRetainedPhoto(ticketId: string, file: File, upload: (ticket: string, file: File, id: string) => Promise<unknown>) {
  const id = ids.get(file);
  if (!id) throw new Error('Photo must be saved on this device before uploading.');
  await upload(ticketId, file, id); await forgetPhoto(id);
}

import type { QueuedTicket } from "./outbox-core";
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("mt-helpdesk-outbox", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("tickets", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Cannot save on this device. Free some storage or use a normal browser window. Your form has not been sent."));
  });
}
async function operation<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("tickets", mode);
    const request = action(transaction.objectStore("tickets"));
    transaction.oncomplete = () => { db.close(); resolve(request.result); };
    transaction.onabort = transaction.onerror = () => { db.close(); reject(new Error("Device storage could not save the request. Free storage and try again.")); };
  });
}
export const saveQueued = (entry: QueuedTicket) => operation("readwrite", store => store.put(entry)).then(() => { window.dispatchEvent(new Event("mt-outbox")); });
export const removeQueued = (id: string) => operation("readwrite", store => store.delete(id)).then(() => { window.dispatchEvent(new Event("mt-outbox")); });
export const listQueued = (uid: string) => operation<QueuedTicket[]>("readonly", store => store.getAll()).then(rows => rows.filter(row => row.uid === uid).sort((a,b) => a.createdAt-b.createdAt));

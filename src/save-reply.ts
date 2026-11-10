import { sendOnline } from './send-online.ts';
export async function saveReply(options: {
  base: string; token: string; uid: string; role: string; requesterId: string;
  ticketId: string; id: string; note: object; fields: object; canEdit: boolean;
}, request: typeof fetch = fetch, online = navigator.onLine) {
  if (!online) throw new Error('No internet connection. Your reply is kept.');
  const params = new URLSearchParams({ auth: options.token });
  let readPath = `tickets/${options.ticketId}`;
  if (options.requesterId === options.uid || options.role === 'IT Technician') {
    readPath = 'tickets';
    params.set('orderBy', JSON.stringify(options.requesterId === options.uid ? 'requesterId' : 'technicianId'));
    params.set('equalTo', JSON.stringify(options.uid));
  }
  const check = await request(`${options.base}/${readPath}.json?${params}`, { signal: AbortSignal.timeout(25000) });
  if (!check.ok) throw new Error('Cannot verify reply delivery. Check your access and retry.');
  const data = await check.json(), live = readPath === 'tickets' ? data?.[options.ticketId] : data;
  if (!live) throw new Error('This ticket is unavailable. Your reply is kept.');
  if (live.updates?.[options.id]) return;
  const path = options.canEdit ? `tickets/${options.ticketId}` : `tickets/${options.ticketId}/updates/${options.id}`;
  await sendOnline(`${options.base}/${path}.json?auth=${encodeURIComponent(options.token)}`,
    options.canEdit ? { ...options.fields, [`updates/${options.id}`]: options.note } : options.note,
    online, request, options.canEdit ? 'PATCH' : 'PUT');
}
export async function bounded<T>(promise: Promise<T>, ms = 25000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Connection timed out. Your form is kept; retry when connected.')), ms); })]); }
  finally { clearTimeout(timer!); }
}

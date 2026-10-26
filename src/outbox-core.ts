export type QueuedTicket = {
  id: string; uid: string; ticket: Record<string, any>;
  photos: { id: string; file: File; sent?: boolean }[];
  saved: boolean; attempted: boolean; message: string; createdAt: number;
};
// Callers first check delivery using the owner-filtered read. Employee rules reject
// updates to existing tickets. Accounts with direct read access also use an ETag guard.
export async function createOnce(url: string, ticket: Record<string, any>, request: typeof fetch = fetch, conditional = false) {
  const response = await request(url, {
    method: "PUT", headers: { "Content-Type": "application/json", ...(conditional ? { "if-match": "null_etag" } : {}) },
    body: JSON.stringify(ticket), signal: AbortSignal.timeout(25000),
  });
  if (response.ok) return;
  if (response.status === 412) {
    const existing = await response.json();
    if (existing?.requesterId === ticket.requesterId && existing?.createdAt === ticket.createdAt) return;
    throw new Error("This request ID is already used. Contact IT; the queued request was kept.");
  }
  if (response.status === 401 || response.status === 403) throw new Error("Access was denied. Sign in again or ask IT to check your account. Your request is still saved.");
  throw new Error("The server could not accept the request. It will retry when connected.");
}

export async function deliver(entry: QueuedTicket, deps: {
  active: () => boolean;
  persist: (entry: QueuedTicket) => Promise<void>;
  create: () => Promise<void>;
  upload: (photo: QueuedTicket["photos"][number]) => Promise<void>;
  complete: () => Promise<void>;
}) {
  if (!deps.active()) return;
  if (!entry.saved) {
    entry.attempted = true;
    await deps.persist(entry);
    if (!deps.active()) return;
    await deps.create();
    entry.saved = true;
    await deps.persist(entry);
  }
  for (const photo of entry.photos) {
    if (!deps.active()) return;
    if (photo.sent) continue;
    await deps.upload(photo);
    photo.sent = true;
    await deps.persist(entry);
  }
  if (deps.active()) await deps.complete();
}

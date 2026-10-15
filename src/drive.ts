import { auth } from './firebase';
import config from './drive-config.json';
export type DrivePhoto = { id: string; name: string; mime: string; size: number; createdAt: number };
export const driveReady = !!config.webAppUrl;
import { validatePhotos } from './ticket-submission';
export { MAX_PHOTOS, MAX_PHOTO_BYTES } from './ticket-submission';

export async function driveRequest<T>(ticketId: string, action: string, extra: object = {}): Promise<T> {
  if (!driveReady) throw new Error('Photo uploads are currently unavailable.');
  if (!auth.currentUser) throw new Error('Sign in to access photos.');
  const idToken = await auth.currentUser.getIdToken();
  const response = await fetch(config.webAppUrl, {
    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow',
    body: JSON.stringify({ ...extra, action, ticketId, idToken }),
  });
  if (!response.ok) throw new Error('The photo service is unavailable. Please try again.');
  let value;
  try { value = await response.json(); }
  catch { throw new Error('The photo service did not respond correctly. Contact IT Admin.'); }
  if (!value.ok) throw new Error(value.error || 'Photo request failed.');
  return value as T;
}

export async function uploadPhoto(ticketId: string, file: File) {
  validatePhotos([file]);
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('The photo could not be read.'));
    reader.readAsDataURL(file);
  });
  return driveRequest<{ file: DrivePhoto }>(ticketId, 'upload', { name: file.name, mime: file.type, base64 });
}

// Saving a ticket succeeds independently of email delivery. The scheduled worker retries later.
export function wakeTicketNotifications(ticketId: string) {
  if (driveReady) void driveRequest(ticketId, 'notify').catch(() => {});
}

// Temporary password is sent over HTTPS only; never stored in the database.
export async function sendUserWelcome(userId: string, temporaryPassword: string) {
  return driveRequest(userId, 'welcome', { userId, temporaryPassword });
}

import { auth } from './firebase';
import config from './drive-config.json';
export type DrivePhoto = { id: string; name: string; mime: string; size: number; createdAt: number };
export const driveReady = !!config.webAppUrl;
export const MAX_PHOTOS = 5;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

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
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP photo.');
  if (!file.size || file.size > MAX_PHOTO_BYTES) throw new Error('Each photo must be 5 MB or smaller.');
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('The photo could not be read.'));
    reader.readAsDataURL(file);
  });
  return driveRequest<{ file: DrivePhoto }>(ticketId, 'upload', { name: file.name, mime: file.type, base64 });
}

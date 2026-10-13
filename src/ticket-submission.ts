export const MAX_PHOTOS = 5;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
type Photo = { name: string; type: string; size: number };

export function validatePhotos(photos: readonly Photo[]) {
  if (photos.length > MAX_PHOTOS) throw new Error(`Choose up to ${MAX_PHOTOS} photos per request.`);
  for (const photo of photos) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.type)) throw new Error(`${photo.name}: choose a JPG, PNG, or WebP photo.`);
    if (!photo.size || photo.size > MAX_PHOTO_BYTES) throw new Error(`${photo.name}: each photo must be between 1 byte and 5 MB.`);
  }
}

// Once saved, attachment failures return the existing ticket rather than resubmitting it.
export async function submitWithPhotos<T extends { id: string }, P extends Photo>(
  photos: readonly P[], save: () => Promise<T>, upload: (id: string, photo: P) => Promise<unknown>,
  progress: (index: number, total: number) => void = () => {},
) {
  validatePhotos(photos);
  const ticket = await save();
  for (let index = 0; index < photos.length; index++) {
    try {
      progress(index + 1, photos.length);
      await upload(ticket.id, photos[index]);
    } catch (error) {
      return { ticket, incomplete: photos.slice(index), error };
    }
  }
  return { ticket, incomplete: [] as readonly P[], error: undefined };
}

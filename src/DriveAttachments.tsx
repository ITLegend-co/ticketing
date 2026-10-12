import { ChangeEvent, useEffect, useState } from 'react';
import { driveReady, driveRequest, DrivePhoto, MAX_PHOTOS, uploadPhoto } from './drive';

export default function DriveAttachments({ ticketId, canUpload }: { ticketId: string; canUpload: boolean }) {
  const [photos, setPhotos] = useState<DrivePhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(driveReady);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  useEffect(() => {
    if (!driveReady) return;
    let active = true;
    driveRequest<{ files: DrivePhoto[] }>(ticketId, 'list')
      .then((result) => { if (active) setPhotos(result.files); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'Could not load photos.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ticketId]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = '';
    if (!files.length || busy) return;
    if (photos.length + files.length > MAX_PHOTOS) { setError('A request can have up to 5 photos.'); return; }
    setBusy(true); setError('');
    try {
      for (const file of files) {
        const result = await uploadPhoto(ticketId, file);
        setPhotos((current) => [...current, result.file]);
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Upload failed.'); }
    finally { setBusy(false); }
  }
  async function view(photo: DrivePhoto) {
    setBusy(true); setError('');
    try {
      const { file } = await driveRequest<{ file: DrivePhoto & { base64: string } }>(ticketId, 'download', { fileId: photo.id });
      const bytes = Uint8Array.from(atob(file.base64), (character) => character.charCodeAt(0));
      setPreview({ url: URL.createObjectURL(new Blob([bytes], { type: file.mime })), name: file.name });
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not view photo.'); }
    finally { setBusy(false); }
  }
  return <section className="request-photos"><h3>Photos</h3>
    {!driveReady ? <p>Photo uploads are currently unavailable.</p> : <>
      {loading ? <p>Loading photos…</p> : photos.length ? <ul>{photos.map((photo) => <li key={photo.id}><button type="button" className="text-btn" disabled={busy} onClick={() => view(photo)}>{photo.name}</button><small>{(photo.size / 1024 / 1024).toFixed(1)} MB</small></li>)}</ul> : <p>No photos attached.</p>}
      {canUpload && <label className="photo-upload">{busy ? 'Please wait…' : 'Add photos'}<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy || loading || photos.length >= MAX_PHOTOS} onChange={upload}/><small>Up to 5 JPG, PNG, or WebP photos · 5 MB each</small></label>}
      {error && <p className="photo-error" role="alert">{error}</p>}
      {preview && <div className="photo-preview"><button type="button" className="secondary-btn" onClick={() => setPreview(null)}>Close photo</button><img src={preview.url} alt={preview.name}/><a className="text-btn" href={preview.url} download={preview.name}>Download photo</a></div>}
    </>}
  </section>;
}

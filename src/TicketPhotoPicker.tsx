import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { validatePhotos, MAX_PHOTOS } from './ticket-submission';

function PhotoPreview({ file }: { file: File }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return <img src={url || undefined} alt={file.name}/>;
}

export default function TicketPhotoPicker({ files, onChange, disabled }: {
  files: File[]; onChange: (files: File[]) => void; disabled: boolean;
}) {
  const [error, setError] = useState('');
  return <div className="ticket-photo-picker full">
    <label>Photos (optional)
      <small>Up to 5 pictures, 5 MB each. JPG, PNG, or WebP.</small>
      <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled || files.length >= MAX_PHOTOS} onChange={(event) => {
        const additions = Array.from(event.currentTarget.files || []);
        event.currentTarget.value = '';
        const next = [...files];
        for (const file of additions) {
          if (!next.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) next.push(file);
        }
        try { validatePhotos(next); onChange(next); setError(''); }
        catch (caught) { setError(caught instanceof Error ? caught.message : 'Choose another photo.'); }
      }}/>
    </label>
    {!!files.length && <ul className="selected-photos">{files.map((file, index) => <li key={`${file.name}-${file.size}-${file.lastModified}`}>
      <PhotoPreview file={file}/><span>{file.name}<small>{(file.size / 1024 / 1024).toFixed(2)} MB</small></span>
      <button type="button" className="icon-btn" disabled={disabled} aria-label={`Remove ${file.name}`} onClick={() => { onChange(files.filter((_, i) => i !== index)); setError(''); }}><X size={16}/></button>
    </li>)}</ul>}
    {error && <p className="photo-error" role="alert">{error}</p>}
  </div>;
}

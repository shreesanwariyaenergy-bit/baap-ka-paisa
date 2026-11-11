'use client';
import { useEffect, useState } from 'react';

/** Shows a full link for a site path with working Copy and WhatsApp share buttons. */
export function CopyLink({ path, shareText }: { path: string; shareText: string }) {
  const [url, setUrl] = useState(path);
  const [msg, setMsg] = useState('');
  useEffect(() => setUrl(window.location.origin + path), [path]);
  const copy = async () => { try { await navigator.clipboard.writeText(url); setMsg('Link copied.'); } catch { setMsg('Select the link above and copy it.'); } };
  return (
    <div>
      <label className="field"><span className="field-label">Link</span><input readOnly value={url} onFocus={(e) => e.currentTarget.select()} data-testid="copy-link-input" /></label>
      <div className="modal-actions">
        <button className="btn" type="button" onClick={copy} data-testid="copy-link">Copy link</button>
        <a className="btn light" href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}`} target="_blank" rel="noopener noreferrer" data-testid="whatsapp-share">Share on WhatsApp</a>
      </div>
      <p className="share-status" role="status">{msg}</p>
    </div>
  );
}

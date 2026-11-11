'use client';
// Real share flow: the image is rendered by the server (/api/seal-card/[username]) at 1080 × 1920.
import { useEffect, useRef, useState } from 'react';

export function SealShare({ username, label }: { username: string; label: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState('');
  const img = `/api/seal-card/${encodeURIComponent(username)}`;
  const profilePath = `/u/${encodeURIComponent(username)}`;
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  const share = async () => {
    try {
      const res = await fetch(img);
      if (!res.ok) throw new Error('image');
      const file = new File([await res.blob()], `baap-ka-paisa-seal-${username}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'The Seal · BAAP KA PAISA', url: window.location.origin + profilePath });
        setStatus('Shared.');
      } else setStatus('This browser cannot share images directly. Use Download image instead.');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setStatus('The share image could not be prepared. Try Download image.');
    }
  };
  const copy = async () => {
    const url = window.location.origin + profilePath;
    try { await navigator.clipboard.writeText(url); setStatus(`Profile link copied: ${url}`); }
    catch { setStatus(`Copy this link: ${url}`); }
  };
  return (
    <>
      <button className="btn block" type="button" onClick={() => { setStatus(''); ref.current?.showModal(); }} data-testid="share-seal">Share The Seal <span className="arrow">↗</span></button>
      <dialog ref={ref} className="modal wide" aria-labelledby="share-title" onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
        <div className="modal-inner">
          <button className="modal-close" type="button" onClick={() => ref.current?.close()} aria-label="Close">×</button>
          <div className="eyebrow">Share The Seal</div>
          <h2 id="share-title">Story card</h2>
          <div className="share-grid">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="share-preview" src={img} alt={`Share image for ${label}: member number, current standing and season.`} width={1080} height={1920} />
            <div>
              <p>1080 × 1920 image for Instagram Stories, Snapchat or WhatsApp Status. It shows only what your public profile shows.</p>
              <div className="modal-actions">
                <a className="btn" href={img} download={`baap-ka-paisa-seal-${username}.png`} data-testid="download-seal">Download story image</a>
                <button className="btn light" type="button" onClick={share}>Share…</button>
                <button className="btn light" type="button" onClick={copy} data-testid="copy-seal-link">Copy share link</button>
                <a className="btn light" href={`https://wa.me/?text=${encodeURIComponent(`My Seal on BAAP KA PAISA. Come and try to pass me. ${origin}${profilePath}`)}`} target="_blank" rel="noopener noreferrer" data-testid="whatsapp-seal">WhatsApp</a>
              </div>
              <p className="share-status" role="status">{status}</p>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}

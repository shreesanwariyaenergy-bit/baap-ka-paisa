'use client';
// Immediate feedback for every in-site navigation, including ones that stay on the same page with new filters
// (where Next.js keeps the old page until the new one arrives): a thin bar appears on click and goes as soon as
// the new address is in place. Pure feedback: it changes no data and no routing.
import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export const NAV_START = 'bkp:navstart';
export const startNav = () => window.dispatchEvent(new Event(NAV_START));

export function NavProgress() {
  const path = usePathname(); const search = useSearchParams();
  const [busy, setBusy] = useState(false);
  useEffect(() => { setBusy(false); }, [path, search]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      setBusy(true);
    };
    const onStart = () => setBusy(true);
    document.addEventListener('click', onClick, true);
    window.addEventListener(NAV_START, onStart);
    return () => { document.removeEventListener('click', onClick, true); window.removeEventListener(NAV_START, onStart); };
  }, []);
  useEffect(() => { if (!busy) return; const t = setTimeout(() => setBusy(false), 15000); return () => clearTimeout(t); }, [busy]);
  return busy ? <div className="nav-progress" role="progressbar" aria-label="Loading page" data-loading="" /> : null;
}

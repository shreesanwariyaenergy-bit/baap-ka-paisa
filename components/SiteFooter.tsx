'use client';
// Footer navigation: four groups. On phones each group is an accordion (a real button with aria-expanded);
// from 721px up all four show as open columns and the headings are plain text.
import Link from 'next/link';
import { useEffect, useState } from 'react';

const GROUPS: { id: string; title: string; links: { href: string; label: string }[] }[] = [
  { id: 'explore', title: 'Explore', links: [{ href: '/archive', label: 'Archive' }, { href: '/throne', label: 'Throne history' }] },
  { id: 'competition', title: 'Competition', links: [{ href: '/closing', label: 'The Closing' }, { href: '/simulator', label: 'Season simulator · demo' }, { href: '/rank-up', label: 'Rank Up preview' }] },
  { id: 'account', title: 'Account & Invite', links: [{ href: '/join', label: 'Create profile' }, { href: '/invite', label: 'Invite' }] },
  { id: 'legal', title: 'Legal', links: [{ href: '/legal/terms', label: 'Terms' }, { href: '/legal/privacy', label: 'Privacy' }, { href: '/legal/refunds', label: 'Refunds' }, { href: '/legal/community', label: 'Guidelines' }, { href: '/legal/grievance', label: 'Grievance' }] },
];

const DESKTOP = '(min-width: 721px)';

export function FooterNav() {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP);
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return (
    <div className="footer-groups">
      {GROUPS.map((g) => {
        const expanded = desktop || !!open[g.id];
        const listId = `footer-${g.id}`;
        return (
          <nav key={g.id} className="footer-group" aria-label={g.title} data-testid={`footer-group-${g.id}`}>
            <h2 className="footer-head">
              {desktop ? <span>{g.title}</span> : (
                <button type="button" aria-expanded={expanded} aria-controls={listId} onClick={() => setOpen((o) => ({ ...o, [g.id]: !o[g.id] }))}>
                  <span>{g.title}</span><span className="footer-sign" aria-hidden="true">{expanded ? '−' : '+'}</span>
                </button>
              )}
            </h2>
            <ul id={listId} className="footer-links" hidden={!expanded}>
              {g.links.map((l) => <li key={l.href}><Link href={l.href}>{l.label}</Link></li>)}
            </ul>
          </nav>
        );
      })}
    </div>
  );
}

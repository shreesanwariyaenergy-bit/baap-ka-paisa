'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { PrefetchKind } from 'next/dist/client/components/router-reducer/router-reducer-types';

const ITEMS = [
  { href: '/', long: 'The scene', short: 'Scene' },
  { href: '/board', long: 'The board', short: 'Board' },
  { href: '/gazette', long: 'Gazette', short: 'Gazette' },
  { href: '/cities', long: 'Cities', short: 'Cities' },
  { href: '/india', long: 'India', short: 'India' },
  { href: '/seal', long: 'The Seal', short: 'Seal' },
];

// The six main sections are prefetched in full (page data included), so a tap renders straight from the browser's
// router cache instead of waiting for a server round trip. The cache keeps them for staleTimes.static (next.config);
// after every navigation, and when the tab comes back into view, expired entries are fetched again. Fresh entries
// are reused without a request. The prefetch carries the visitor's own cookies and stays in their own browser.
export function MainNav() {
  const path = usePathname();
  const router = useRouter();
  useEffect(() => {
    const warm = () => { for (const i of ITEMS) router.prefetch(i.href, { kind: PrefetchKind.FULL }); };
    const t = setTimeout(warm, 300);   // after the new page has painted
    const onVisible = () => { if (document.visibilityState === 'visible') warm(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearTimeout(t); document.removeEventListener('visibilitychange', onVisible); };
  }, [path, router]);
  return (
    <nav className="main-nav" aria-label="Main navigation">
      {ITEMS.map((i) => {
        const active = i.href === '/' ? path === '/' : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} prefetch aria-current={active ? 'page' : undefined}>
            <span className="long">{i.long}</span><span className="short">{i.short}</span>
          </Link>
        );
      })}
    </nav>
  );
}

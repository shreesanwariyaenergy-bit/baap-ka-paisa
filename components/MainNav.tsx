'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/', long: 'The scene', short: 'Scene' },
  { href: '/board', long: 'The board', short: 'Board' },
  { href: '/gazette', long: 'Gazette', short: 'Gazette' },
  { href: '/cities', long: 'Cities', short: 'Cities' },
  { href: '/india', long: 'India', short: 'India' },
  { href: '/seal', long: 'The Seal', short: 'Seal' },
];

export function MainNav() {
  const path = usePathname();
  return (
    <nav className="main-nav" aria-label="Main navigation">
      {ITEMS.map((i) => {
        const active = i.href === '/' ? path === '/' : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} aria-current={active ? 'page' : undefined}>
            <span className="long">{i.long}</span><span className="short">{i.short}</span>
          </Link>
        );
      })}
    </nav>
  );
}

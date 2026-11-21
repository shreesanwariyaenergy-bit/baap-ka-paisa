import type { Metadata } from 'next';
import Link from 'next/link';
import { pageJsonLd, pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';

// How the register works, in one public page. Every statement here is already made elsewhere on the site (the home
// "How the register works" card, the season rules, the Seal, the draft terms). Static: no data is read.
const TITLE = 'How It Works: Seasons, Ranks and the Throne';
const DESCRIPTION = 'Who owns the throne? How BAAP KA PAISA works: claim your territory, take a rank on four boards, hold it or lose it. Monthly seasons; the record stays.';

export const metadata: Metadata = pageMetadata({ title: TITLE, path: '/how-it-works', description: DESCRIPTION });

const STEPS: { no: string; title: string; body: string; link?: { href: string; label: string } }[] = [
  { no: '01', title: 'Claim your territory', body: 'Create a profile, pick your city and locality, and get a permanent member ID. Members must be 18 or older, one profile per person.', link: { href: '/cities', label: 'Find your city' } },
  { no: '02', title: 'Take a rank', body: 'One entry places you on four boards at once: your locality, your city, your state and India. Season Score decides the order; if two members reach the same score, whoever got there first ranks higher.', link: { href: '/board', label: 'Open the board' } },
  { no: '03', title: 'Hold it or lose it', body: 'Anyone can pass you. To pass someone, your Season Score must reach theirs plus ₹500. Whoever holds #01 holds the throne, and the gold crown marks only the current holder.', link: { href: '/throne', label: 'See throne history' } },
  { no: '04', title: 'Every month, a new season', body: 'Boards reset on the 1st and every throne is empty again. Taking a #01 in the last 15 minutes extends the close by 15 minutes, so nobody wins by sniping.', link: { href: '/gazette', label: 'Read the Gazette' } },
  { no: '05', title: 'The record stays', body: 'Final standings and every city’s champion are kept in the archive for good. Lifetime Score carries across seasons.', link: { href: '/archive', label: 'Open the archive' } },
  { no: '06', title: 'The Seal', body: 'Your permanent member identity. The number never changes; your rank moves every season; every crown and achievement you earn stays on your Seal.', link: { href: '/seal', label: 'See The Seal' } },
];

export default function HowItWorksPage() {
  return (
    <>
      <JsonLd data={pageJsonLd({ name: 'How It Works', path: '/how-it-works', description: DESCRIPTION })} />
      <section className="page-intro">
        <div><div className="eyebrow">The rules of the register / 06</div><h1>How it<br />works.</h1></div>
        <p>Who owns the throne? BAAP KA PAISA decides it in the open, board by board, season by season.</p>
      </section>
      <ol className="how-steps">
        {STEPS.map((s) => (
          <li key={s.no}>
            <span className="how-no" aria-hidden="true">{s.no}</span>
            <h2>{s.title}</h2>
            <p>{s.body}</p>
            {s.link && <Link className="textlink" href={s.link.href}>{s.link.label} ↗</Link>}
          </li>
        ))}
      </ol>
      <div className="notice" role="note" style={{ margin: '0 0 22px' }}>
        <b>Before Season 1.</b> Rankings open with Season 1 and payments are not open yet. There are no prizes, no cash-outs and no wallet: just the record.
      </div>
      <div className="hero-cta" style={{ marginBottom: 70 }}>
        <Link className="btn" href="/join">Create your profile <span className="arrow" aria-hidden="true">↗</span></Link>
        <Link className="btn light" href="/board">Explore the board</Link>
      </div>
    </>
  );
}

import type { Metadata, Viewport } from 'next';
import { Barlow_Condensed, Changa_One, DM_Mono, Karla } from 'next/font/google';
import Link from 'next/link';
import './globals.css';
import { getDataSource } from '@/lib/data';
import { timeLeft } from '@/lib/season';
import { initials } from '@/lib/format';
import { MainNav } from '@/components/MainNav';
import { ProfileDialogProvider } from '@/components/ProfileDialog';

const barlow = Barlow_Condensed({ subsets: ['latin', 'latin-ext'], weight: ['500', '600', '700', '800'], variable: '--font-barlow', display: 'swap' });
const changa = Changa_One({ subsets: ['latin'], weight: '400', variable: '--font-changa', display: 'swap' });
const karla = Karla({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600', '700', '800'], style: ['normal', 'italic'], variable: '--font-karla', display: 'swap' });
const dmMono = DM_Mono({ subsets: ['latin', 'latin-ext'], weight: ['400', '500'], variable: '--font-dmmono', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'BAAP KA PAISA — The Public Status Register', template: '%s · BAAP KA PAISA' },
  description: 'City-first status rankings across locality, city, state and India. Monthly seasons; the record stays.',
  robots: { index: false, follow: false }, // not launched: keep out of search engines until approved
};
// Rankings change constantly: render every request on the server, never from a build-time snapshot.
export const dynamic = 'force-dynamic';

export const viewport: Viewport = { themeColor: '#183F37', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const ds = getDataSource();
  const season = ds.season();
  const left = timeLeft(season, ds.now());
  const viewer = await ds.viewer();
  const viewerLabel = viewer ? (viewer.member.masked ? viewer.member.publicLabel : viewer.member.displayName ?? viewer.member.username) : null;
  return (
    <html lang="en-IN" className={`${barlow.variable} ${changa.variable} ${karla.variable} ${dmMono.variable}`}>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <div className="topline">
          <div className="live"><i className="dot" aria-hidden="true" /> The public status register <span style={{ opacity: .5 }}>/</span> India</div>
          <div className="rightline">
            <span className="opt">{season.label}</span>
            <span className="opt" aria-hidden="true">•</span>
            <span className="opt">{left.closed ? 'Season closed' : `${left.days} days left`}</span>
            {ds.availability === 'demo' && <span className="demo-flag" data-testid="demo-flag">Demo data</span>}
            {ds.availability === 'unavailable' && <span className="demo-flag">Not open yet</span>}
          </div>
        </div>
        <ProfileDialogProvider>
          <div className="shell">
            <header className="site-header">
              <Link className="brand" href="/" aria-label="BAAP KA PAISA home">
                <span className="brandmark" aria-hidden="true">B₹</span>
                <span className="brandname">BAAP KA PAISA<small>The status register</small></span>
              </Link>
              <MainNav />
              <div className="header-right">
                <div className="season-pill">{season.short}</div>
                {viewer ? (
                  <Link className="avatar-mini" href="/seal" aria-label={`Signed in as ${viewerLabel}. Open The Seal.`}>{initials(viewerLabel!)}</Link>
                ) : (
                  <span className="signin-note">Sign-in not open</span>
                )}
              </div>
            </header>
            <main id="main">{children}</main>
            <footer className="site-footer">
              <span>BAAP KA PAISA © {season.year}</span>
              <span>{ds.availability === 'demo' ? 'Demo data · not live · no payments' : 'Payments are not open'}</span>
              <span>Made for the public record</span>
            </footer>
          </div>
        </ProfileDialogProvider>
      </body>
    </html>
  );
}

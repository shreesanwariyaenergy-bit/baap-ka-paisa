import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './fonts.css';
import './globals.css';
import { getDataSource } from '@/lib/data';
import { initials, memberNo } from '@/lib/format';
import { signOut } from './auth-actions';
import { currentAccount } from '@/lib/supabase-server';
import { indexingAllowed } from '@/lib/flags';
import { MainNav } from '@/components/MainNav';
import { FooterNav } from '@/components/SiteFooter';
import { NavProgress } from '@/components/NavProgress';
import { Suspense } from 'react';
import { ProfileDialogProvider } from '@/components/ProfileDialog';


// Search engines stay blocked until BKP_ALLOW_INDEXING=true (public launch approval).
export function generateMetadata(): Metadata {
  return { ...baseMetadata, robots: indexingAllowed() ? { index: true, follow: true } : { index: false, follow: false } };
}
const baseMetadata: Metadata = {
  title: { default: 'BAAP KA PAISA — The Public Status Register', template: '%s · BAAP KA PAISA' },
  description: 'City-first status rankings across locality, city, state and India. Monthly seasons; the record stays.',
};
// Rankings change constantly: render every request on the server, never from a build-time snapshot.
export const dynamic = 'force-dynamic';

export const viewport: Viewport = { themeColor: '#0C251F', width: 'device-width', initialScale: 1 };

// The shell (navigation, page skeleton) streams at once. The parts that need the database (season pill and
// account area, footer year) stream in their own boundaries, so the first paint and the page's
// own loading state never wait for a database round trip.
async function HeaderAccount() {
  const ds = await getDataSource();
  const season = ds.season();
  const viewer = await ds.viewer();
  const account = viewer ? null : await currentAccount();
  const viewerLabel = viewer ? (viewer.member.masked ? viewer.member.publicLabel : viewer.member.displayName ?? viewer.member.username) : null;
  return (
    <>
      <div className="season-pill">{season.short}</div>
      {viewer ? (
        <details className="profile-menu" data-testid="profile-menu">
          <summary aria-label={`Account menu for ${viewerLabel}`}>
            <span className="avatar-mini" aria-hidden="true">{initials(viewerLabel!)}</span>
            <span className="who">{viewer.member.masked ? viewer.member.publicLabel : `@${viewer.member.username}`}<small>{ds.availability === 'demo' ? 'Demo member · ' : ''}No. {memberNo(viewer.member.memberNo)}</small></span>
          </summary>
          <div className="menu">
            <Link href="/seal">The Seal</Link>
            <Link href="/me">Profile</Link>
            <Link href="/invite">Invite friends</Link>
            <form action={signOut}><button type="submit" data-testid="sign-out">Sign out</button></form>
          </div>
        </details>
      ) : (
        <div className="auth-actions" data-testid="auth-actions">
          <Link className="signin" href="/signin">Sign in</Link>
          <Link className="btn" href="/join" data-testid="create-profile">{account ? 'Finish profile' : 'Create profile'}</Link>
        </div>
      )}
    </>
  );
}
// Same footprint as the signed-out header while the account loads, invisible and not focusable.
const HeaderAccountFallback = () => (
  <>
    <div className="season-pill" style={{ visibility: 'hidden' }} aria-hidden="true">S00 / NOV &apos;26</div>
    <div className="auth-actions" style={{ visibility: 'hidden' }} aria-hidden="true"><span className="signin">Sign in</span><span className="btn">Create profile</span></div>
  </>
);

async function FooterYear() {
  const ds = await getDataSource();
  return <>© {ds.season().year}</>;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <Suspense fallback={null}><NavProgress /></Suspense>
        <ProfileDialogProvider>
          <div className="shell">
            <header className="site-header">
              <Link className="brand" href="/" aria-label="BAAP KA PAISA home">
                <span className="brandmark" aria-hidden="true">B₹</span>
                <span className="brandname">BAAP KA PAISA<small>The status register</small></span>
              </Link>
              <MainNav />
              <div className="header-right">
                <Suspense fallback={<HeaderAccountFallback />}><HeaderAccount /></Suspense>
              </div>
            </header>
            <main id="main">{children}</main>
            <footer className="site-footer">
              <div className="footer-top">
                <span className="footer-wordmark">BAAP KA PAISA</span>
                <span className="footer-copy"><Suspense fallback={null}><FooterYear /></Suspense></span>
              </div>
              <FooterNav />
            </footer>
          </div>
        </ProfileDialogProvider>
      </body>
    </html>
  );
}

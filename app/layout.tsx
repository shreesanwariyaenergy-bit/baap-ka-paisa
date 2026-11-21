import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './fonts.css';
import './globals.css';
import { getDataSource } from '@/lib/data';
import { initials, memberNo } from '@/lib/format';
import { signOut } from './auth-actions';
import { currentAccount } from '@/lib/supabase-server';
import { MainNav } from '@/components/MainNav';
import { BrandLogo } from '@/components/BrandLogo';
import { FooterNav } from '@/components/SiteFooter';
import { NavProgress } from '@/components/NavProgress';
import { Suspense } from 'react';
import { preload } from 'react-dom';
import { ProfileDialogProvider } from '@/components/ProfileDialog';
import { HOME_TITLE, SITE_NAME, canonicalOrigin, indexingAllowed } from '@/lib/seo';


// Indexing is allowed only in production on the canonical host (lib/seo.ts); previews, local development and other
// hosts stay noindex. Canonical and Open Graph addresses always resolve against https://baapkapaisa.com.
export async function generateMetadata(): Promise<Metadata> {
  const index = await indexingAllowed();
  return {
    ...baseMetadata,
    metadataBase: new URL(canonicalOrigin()),
    robots: index ? { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } } : { index: false, follow: false },
  };
}
const baseMetadata: Metadata = {
  title: { default: HOME_TITLE, template: '%s | BAAP KA PAISA' },
  description: 'Who owns the throne? Locality, city, state and national boards on BAAP KA PAISA, the public status register. Monthly seasons; the record stays.',
  // Stable icon addresses (no content hashes): the full logo on paper. Google uses a square icon in multiples of 48 px.
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 24x24 32x32 48x48 64x64', type: 'image/x-icon' },
      { url: '/brand/favicon-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/brand/favicon-96.png', sizes: '96x96', type: 'image/png' },
      { url: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/brand/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  applicationName: SITE_NAME,
  openGraph: { type: 'website', siteName: SITE_NAME, locale: 'en_IN' },
  twitter: { card: 'summary_large_image' },
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
  // The three font files every first screen needs (body text, mono labels, the display headline) are requested with
  // the page instead of after the stylesheet has been parsed. All other weights and subsets load on demand.
  for (const f of ['ibm-plex-sans-latin-wght-normal', 'ibm-plex-mono-latin-700-normal', 'barlow-condensed-latin-900-normal']) {
    preload(`/fonts/${f}.woff2`, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });
  }
  return (
    <html lang="en-IN">
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <Suspense fallback={null}><NavProgress /></Suspense>
        <ProfileDialogProvider>
          <div className="shell">
            <header className="site-header">
              <Link className="brand" href="/" aria-label="BAAP KA PAISA home">
                <BrandLogo height={58} priority decorative className="header-logo" />
              </Link>
              <MainNav />
              <div className="header-right">
                <Suspense fallback={<HeaderAccountFallback />}><HeaderAccount /></Suspense>
              </div>
            </header>
            <main id="main">{children}</main>
            <footer className="site-footer">
              <div className="footer-top">
                <BrandLogo height={64} className="footer-logo" />
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

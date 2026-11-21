// Default social sharing image for every page (Open Graph / X), 1200 × 630, generated once at build time.
// The finalised logo artwork on the cream paper surface, beside the homepage's own headline. Existing colours and the
// same font files as the existing share cards; nothing decorative is added.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'BAAP KA PAISA. Who owns the throne? The public status register.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
  const fonts = path.join(process.cwd(), 'assets', 'fonts');
  const [barlow, mono, logo] = await Promise.all([
    readFile(path.join(fonts, 'BarlowCondensed-Bold.ttf')), readFile(path.join(fonts, 'DMMono-Medium.ttf')),
    readFile(path.join(process.cwd(), 'public', 'brand', 'baap-ka-paisa-logo-480.png')),
  ]);
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`;
  const ink = '#0C251F', lime = '#CCFF00', paper = '#F1EFE6';
  const label = { display: 'flex' as const, fontFamily: 'DM Mono', fontSize: 22, letterSpacing: 4, textTransform: 'uppercase' as const };
  const logoH = 460, logoW = Math.round(logoH * 747 / 760);
  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: 'flex', background: ink, padding: 24 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 48, background: paper, color: ink, padding: '0 56px' }}>
          <img src={logoSrc} width={logoW} height={logoH} alt="" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
            <div style={label}>The public status register</div>
            <div style={{ display: 'flex' }}>
              <span style={{ display: 'flex', fontFamily: 'Barlow Condensed', fontSize: 56, lineHeight: 1, textTransform: 'uppercase', background: lime, padding: '6px 16px', border: `4px solid ${ink}` }}>Who owns the throne?</span>
            </div>
            <div style={{ ...label, fontSize: 20 }}>Your city. Your rank. Your throne.</div>
            <div style={{ ...label, fontSize: 20 }}>baapkapaisa.com</div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: 'Barlow Condensed', data: barlow, weight: 700, style: 'normal' }, { name: 'DM Mono', data: mono, weight: 500, style: 'normal' }] },
  );
}

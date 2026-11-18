// Default social sharing image for every page (Open Graph / X), 1200 × 630, generated once at build time.
// Brand colours and the same font files as the existing share cards; the headline is the homepage's own.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'BAAP KA PAISA — The Public Status Register. Who owns your city?';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
  const dir = path.join(process.cwd(), 'assets', 'fonts');
  const [barlow, mono] = await Promise.all([readFile(path.join(dir, 'BarlowCondensed-Bold.ttf')), readFile(path.join(dir, 'DMMono-Medium.ttf'))]);
  const ink = '#0C251F', lime = '#CCFF00', paper = '#FCF9F0';
  const label = { display: 'flex' as const, fontFamily: 'DM Mono', fontSize: 24, letterSpacing: 4, textTransform: 'uppercase' as const };
  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: 'flex', background: ink, padding: 24 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: paper, color: ink, padding: '44px 56px' }}>
          <div style={{ ...label, justifyContent: 'space-between' }}><span>The public status register</span><span>India</span></div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontFamily: 'Barlow Condensed', fontSize: 150, lineHeight: 0.9, textTransform: 'uppercase', letterSpacing: -2 }}>Baap ka paisa</div>
            <div style={{ display: 'flex', marginTop: 22 }}>
              <span style={{ display: 'flex', fontFamily: 'Barlow Condensed', fontSize: 76, lineHeight: 1, textTransform: 'uppercase', background: lime, padding: '6px 16px', border: `4px solid ${ink}` }}>Who owns your city?</span>
            </div>
          </div>
          <div style={{ ...label, fontSize: 22, justifyContent: 'space-between' }}><span>Locality · City · State · India</span><span>baapkapaisa.com</span></div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: 'Barlow Condensed', data: barlow, weight: 700, style: 'normal' }, { name: 'DM Mono', data: mono, weight: 500, style: 'normal' }] },
  );
}

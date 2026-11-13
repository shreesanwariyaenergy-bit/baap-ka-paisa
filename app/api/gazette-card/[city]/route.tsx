// The Gazette front page as a share image (1080 × 1350, PNG): masthead and today's lead headline, from board records only.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { getDataSource, rankingsOpen } from '@/lib/data';
import { cityById, type Scope } from '@/lib/geo';
import { buildEdition } from '@/lib/gazette';

export const runtime = 'nodejs';
const fontDir = path.join(process.cwd(), 'assets', 'fonts');
const fonts = Promise.all([readFile(path.join(fontDir, 'BarlowCondensed-Bold.ttf')), readFile(path.join(fontDir, 'DMMono-Medium.ttf'))]);

export async function GET(_req: Request, { params }: { params: Promise<{ city: string }> }) {
  const city = cityById((await params).city);
  if (!city) return new Response('Unknown city', { status: 404 });
  const ds = await getDataSource();
  const scope: Scope = { level: 'city', cityId: city.id, locality: city.localities[0] };
  const now = ds.now();
  const [board, reigns, moments, events, cities, respect] = await Promise.all([ds.board(scope, { limit: 10 }), ds.throneHistory({ scope, limit: 40 }),
    ds.crownMoments(scope, new Date(now.getTime() - 7 * 86_400_000)), ds.events(scope, 12), ds.cities(), ds.respectBoard(scope, { limit: 1 })]);
  const ed = buildEdition({ city, season: ds.season(), now, open: rankingsOpen(ds), board, reigns, moments, events, cities, respect });
  const [barlow, mono] = await fonts;
  const ink = '#0C251F', lime = '#CCFF00', paper = '#FCF9F0';
  const label = { display: 'flex' as const, fontFamily: 'DM Mono', fontSize: 24, letterSpacing: 4, textTransform: 'uppercase' as const };
  const big = ed.lead.headline.length > 34 ? 104 : ed.lead.headline.length > 22 ? 132 : 168;
  return new ImageResponse(
    (
      <div style={{ width: 1080, height: 1350, display: 'flex', flexDirection: 'column', background: ink, padding: 28 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: paper, color: ink, padding: 56 }}>
          <div style={{ ...label, justifyContent: 'space-between' }}><span>{ed.issue}</span><span>Price: your pride</span></div>
          <div style={{ display: 'flex', fontFamily: 'Barlow Condensed', fontSize: 118, lineHeight: 0.9, textTransform: 'uppercase', marginTop: 22, justifyContent: 'center' }}>{`The ${city.name} Gazette`}</div>
          <div style={{ display: 'flex', height: 6, background: ink, marginTop: 18 }} /><div style={{ display: 'flex', height: 2, background: ink, marginTop: 6 }} />
          <div style={{ ...label, marginTop: 14, justifyContent: 'space-between' }}><span>{ed.dateline}</span><span>{ds.availability === 'demo' ? 'Demo data' : 'By order of the register'}</span></div>
          <div style={{ ...label, fontSize: 28, color: '#B43A0A', marginTop: 64 }}>{ed.lead.kicker}</div>
          <div style={{ display: 'flex', fontFamily: 'Barlow Condensed', fontSize: big, lineHeight: 0.92, textTransform: 'uppercase', marginTop: 16 }}>{ed.lead.headline}</div>
          <div style={{ display: 'flex', width: 320, height: 22, background: lime, marginTop: 20 }} />
          <div style={{ display: 'flex', fontFamily: 'Barlow Condensed', fontSize: 44, lineHeight: 1.18, marginTop: 36 }}>{ed.lead.body.length > 210 ? `${ed.lead.body.slice(0, 207)}…` : ed.lead.body}</div>
          <div style={{ display: 'flex', flex: 1 }} />
          <div style={{ ...label, fontSize: 20, justifyContent: 'space-between', borderTop: `4px solid ${ink}`, paddingTop: 16 }}><span>BAAP KA PAISA</span><span>No prizes. No cash-outs. The record stays.</span></div>
        </div>
      </div>
    ),
    { width: 1080, height: 1350, fonts: [{ name: 'Barlow Condensed', data: barlow, weight: 700, style: 'normal' }, { name: 'DM Mono', data: mono, weight: 500, style: 'normal' }], headers: { 'Cache-Control': 'private, max-age=60' } },
  );
}

// The declaration card (1080 × 1350, PNG): a poster of a public declaration, from public fields only.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { getDataSource } from '@/lib/data';
import { who } from '@/lib/gazette';

export const runtime = 'nodejs';
const fontDir = path.join(process.cwd(), 'assets', 'fonts');
const fonts = Promise.all([readFile(path.join(fontDir, 'BarlowCondensed-Bold.ttf')), readFile(path.join(fontDir, 'DMMono-Medium.ttf'))]);
const STAMP = { standing: 'STANDING', won: 'MADE GOOD', 'throne-moved': 'THRONE MOVED', lapsed: 'LAPSED' } as const;
const rs = (n: number) => `Rs ${n.toLocaleString('en-IN')}`; // the bundled fonts have no rupee sign

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const d = (await (await getDataSource()).declarations({ id: (await params).id }))[0];
  if (!d) return new Response('Declaration not found', { status: 404 });
  const [barlow, mono] = await fonts;
  const won = d.status === 'won';
  const ink = '#0C251F', hot = '#FF4500', lime = '#CCFF00', paper = '#F1EFE6';
  const label = { display: 'flex' as const, fontFamily: 'DM Mono', fontSize: 26, letterSpacing: 4, textTransform: 'uppercase' as const };
  return new ImageResponse(
    (
      <div style={{ width: 1080, height: 1350, display: 'flex', flexDirection: 'column', background: won ? lime : hot, padding: 36 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: paper, color: ink, border: `6px solid ${ink}`, padding: 56 }}>
          <div style={{ ...label, justifyContent: 'space-between' }}><span>{`Declaration No. ${d.no}`}</span><span>BAAP KA PAISA</span></div>
          <div style={{ display: 'flex', height: 6, background: ink, marginTop: 20 }} />
          <div style={{ display: 'flex', fontFamily: 'Barlow Condensed', fontSize: 132, lineHeight: 0.9, textTransform: 'uppercase', marginTop: 56 }}>{who(d.challenger)}</div>
          <div style={{ ...label, fontSize: 34, color: '#C23A00', marginTop: 26 }}>{won ? 'declared for, and took, the throne of' : 'declares for the throne of'}</div>
          <div style={{ display: 'flex', fontFamily: 'Barlow Condensed', fontSize: 210, lineHeight: 0.86, textTransform: 'uppercase', marginTop: 10 }}>{d.boardName}</div>
          <div style={{ ...label, fontSize: 30, marginTop: 22 }}>{`${won ? 'taken from' : 'held by'} ${who(d.holder)}`}</div>
          <div style={{ display: 'flex', fontFamily: 'Barlow Condensed', fontSize: 58, lineHeight: 1.05, marginTop: 50, borderLeft: `10px solid ${hot}`, paddingLeft: 26 }}>{`“${d.line}”`}</div>
          <div style={{ display: 'flex', flex: 1 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ ...label, fontSize: 22 }}>Needed to take it when declared</div>
              <div style={{ display: 'flex', fontFamily: 'Barlow Condensed', fontSize: 96, lineHeight: 1 }}>{rs(d.required)}</div>
            </div>
            <div style={{ display: 'flex', fontFamily: 'Barlow Condensed', fontSize: 54, padding: '8px 22px', border: `6px solid ${won ? ink : hot}`, color: won ? ink : hot, transform: 'rotate(-6deg)', textTransform: 'uppercase' }}>{STAMP[d.status]}</div>
          </div>
          <div style={{ ...label, fontSize: 20, marginTop: 24, justifyContent: 'space-between', color: '#44524B' }}><span>{d.seasonLabel}</span><span>No prizes. No cash-outs. The record stays.</span></div>
        </div>
      </div>
    ),
    { width: 1080, height: 1350, fonts: [{ name: 'Barlow Condensed', data: barlow, weight: 700, style: 'normal' }, { name: 'DM Mono', data: mono, weight: 500, style: 'normal' }], headers: { 'Cache-Control': 'private, max-age=60' } },
  );
}

// Renders The Seal share image (1080 × 1920, PNG) on the server from public profile fields only.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { getDataSource } from '@/lib/data';
import { STATES, cityById } from '@/lib/geo';
import { memberNo, pad2 } from '@/lib/format';
import { CROWN_GEOMETRY } from '@/components/Crown';

export const runtime = 'nodejs';

const fontDir = path.join(process.cwd(), 'assets', 'fonts');
const fonts = Promise.all([
  readFile(path.join(fontDir, 'BarlowCondensed-Bold.ttf')),
  readFile(path.join(fontDir, 'ChangaOne-Regular.ttf')),
  readFile(path.join(fontDir, 'DMMono-Medium.ttf')),
]);

const C = { paper: '#F1EFE6', ink: '#0C251F', forest: '#0C251F', lime: '#CCFF00', orange: '#FF4500', white: '#FCF9F0', muted: '#B1CCC3', gold: '#E5A93C', goldDk: '#8A5E10', goldHi: '#FFE7A8' };

function CrownMark({ width }: { width: number }) {
  const g = CROWN_GEOMETRY;
  return (
    <svg width={width} height={(width * 48) / 66} viewBox={g.viewBox}>
      <path d={g.inner} fill={C.goldDk} />
      <path d={g.body} fill={C.gold} stroke={C.goldDk} strokeWidth="0.5" />
      <path d={g.band} fill={C.gold} stroke={C.goldDk} strokeWidth="0.5" />
      <path d={g.finial} fill={C.goldHi} stroke={C.goldDk} strokeWidth="0.45" />
      {g.pearls.map(([x, y]) => <circle key={x} cx={x} cy={y} r="1.5" fill={C.gold} stroke={C.goldDk} strokeWidth="0.45" />)}
      <path d={g.engraving} fill="none" stroke={C.goldDk} strokeWidth="0.5" />
      <path d={g.highlight} fill="none" stroke={C.goldHi} strokeWidth="0.7" />
      {g.jewels.map(([x, y, r]) => <circle key={x} cx={x} cy={y} r={r} fill={C.goldDk} />)}
    </svg>
  );
}

export async function GET(_req: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const ds = await getDataSource();
  const m = await ds.member(decodeURIComponent(username));
  if (!m) return new Response('Member not found', { status: 404 });
  const [standings, achievements] = await Promise.all([ds.standings(m.username), ds.achievements(m.username)]);
  const badgeLine = [...new Set(achievements.map((a) => (a.id === 'pioneer' ? a.label : a.id === 'streak' ? '' : a.label)).filter(Boolean))].slice(0, 3).join('  ·  ');
  const streak = achievements.find((a) => a.id === 'streak')?.label;
  const cityStanding = standings.find((s) => s.level === 'city');
  const city = cityById(m.cityId)!;
  const season = ds.season();
  const name = m.masked ? m.publicLabel : m.displayName ?? m.username;
  const rank = cityStanding?.rank ?? null;
  const [barlow, changa, mono] = await fonts;
  const label = { display: 'flex' as const, fontFamily: 'DM Mono', fontSize: 30, letterSpacing: 4, textTransform: 'uppercase' as const };

  return new ImageResponse(
    (
      <div style={{ width: 1080, height: 1920, display: 'flex', flexDirection: 'column', background: C.paper, color: C.ink, padding: 72 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <div style={{ width: 104, height: 104, background: C.orange, color: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Changa One', fontSize: 56, transform: 'rotate(-5deg)', boxShadow: `10px 10px 0 ${C.forest}` }}><span>B</span>
            {/* Rupee sign drawn as a path: none of the bundled fonts include U+20B9. */}
            <svg width="40" height="52" viewBox="0 0 24 30" style={{ marginLeft: 2 }}><path d="M5 4h14M5 10h14M9 4c5 0 7 2.2 7 5.5S13.5 15 9 15H6l11 12" fill="none" stroke={C.white} strokeWidth="3.4" strokeLinecap="square" strokeLinejoin="miter" /></svg></div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontFamily: 'Changa One', fontSize: 64, lineHeight: 0.9 }}>BAAP KA PAISA</div>
            <div style={{ ...label, fontSize: 24, color: '#78847A', marginTop: 12 }}>The status register</div>
          </div>
        </div>
        <div style={{ ...label, color: '#24584C', marginTop: 96, alignItems: 'center', gap: 20 }}><div style={{ width: 64, height: 5, background: C.orange }} />The Seal / permanent identity</div>
        <div style={{ flex: 1, marginTop: 40, background: C.forest, color: C.white, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 64 }}>
          <div style={{ ...label, justifyContent: 'space-between', color: C.muted }}><span>{`${city.name} / city standing`}</span><span>{season.label}</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
              {rank === 1 && <CrownMark width={190} />}
              <div style={{ fontFamily: 'Barlow Condensed', fontSize: 400, lineHeight: 0.8, color: C.lime, letterSpacing: -12 }}>{rank ? (rank === 1 ? '01' : `#${pad2(rank)}`) : '—'}</div>
            </div>
            <div style={{ ...label, color: C.muted, marginTop: 28 }}>{rank ? `of ${cityStanding!.of} in ${city.name}` : `Not ranked in ${city.name}`}</div>
            <div style={{ fontFamily: 'Changa One', fontSize: 84, lineHeight: 1, marginTop: 48, textTransform: 'uppercase' }}>{name}</div>
            <div style={{ ...label, color: C.muted, marginTop: 20 }}>{`${m.locality} · ${city.name} · ${STATES[city.state]}`}</div>
            {(badgeLine || streak) && <div style={{ ...label, fontSize: 24, color: C.lime, marginTop: 36 }}>{[streak, badgeLine].filter(Boolean).join('  ·  ')}</div>}
          </div>
          <div style={{ ...label, justifyContent: 'space-between', borderTop: '2px solid rgba(255,255,255,0.25)', paddingTop: 28, color: C.muted }}>
            <span>{`Member no. ${memberNo(m.memberNo)}`}</span><span style={{ color: C.lime }}>The record stays</span>
          </div>
        </div>
        <div style={{ ...label, fontSize: 26, color: '#5F6B63', marginTop: 40, justifyContent: 'space-between' }}>
          <span>{m.masked ? 'Mystery mode' : `@${m.username}`}</span><span>{season.monthLabel}</span>
        </div>
      </div>
    ),
    {
      width: 1080, height: 1920,
      fonts: [
        { name: 'Barlow Condensed', data: barlow, weight: 700, style: 'normal' },
        { name: 'Changa One', data: changa, weight: 400, style: 'normal' },
        { name: 'DM Mono', data: mono, weight: 500, style: 'normal' },
      ],
      headers: { 'Cache-Control': 'private, max-age=60' },
    },
  );
}

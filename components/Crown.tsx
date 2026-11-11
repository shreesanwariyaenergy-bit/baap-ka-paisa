// CrownMark: the one BAAP KA PAISA crown. An open royal crown drawn for this brand:
// five curved points flaring from a jewelled band, the centre point tallest with a diamond finial.
// It sits on top of the 01 of whichever member holds #01. One design, no gendered variants.
export const CROWN_GEOMETRY = {
  viewBox: '-1 -1 66 48',
  /** Five-pointed body, flaring outward, sitting on the curved top edge of the band. */
  body: 'M5 33C4 26 3 20 2 14C5 19 7 23 10 25C13 22 15.5 16 17 10C18.5 16 21 22 24.5 24C28 21 30.5 12 32 4C33.5 12 36 21 39.5 24C43 22 45.5 16 47 10C48.5 16 51 22 54 25C57 23 59 19 62 14C61 20 60 26 59 33Q32 40 5 33Z',
  /** Inside of the crown seen through the open top of the band. */
  inner: 'M5 33Q32 26.5 59 33Q32 40 5 33Z',
  /** Front of the band. */
  band: 'M5 33Q32 40 59 33L59 38.6Q32 46.4 5 38.6Z',
  /** Diamond finial on the centre point, pearls on the other four. */
  finial: 'M32 -.6 34.3 3 32 6.6 29.7 3Z',
  pearls: [[2, 13.2], [17, 9.2], [47, 9.2], [62, 13.2]] as const,
  /** Jewels along the band, following its curve. */
  jewels: [[12, 37.5, 1.1], [22, 39.1, 1.25], [32, 39.7, 1.5], [42, 39.1, 1.25], [52, 37.5, 1.1]] as const,
  /** Engraved scrollwork inside the points and the band edges. */
  engraving: 'M32 12v9M29.4 18.5c1 .9 1.8 2 2.6 3.6c.8-1.6 1.6-2.7 2.6-3.6M17 16v6.5M15.2 20.6c.7.6 1.3 1.4 1.8 2.6c.5-1.2 1.1-2 1.8-2.6M47 16v6.5M45.2 20.6c.7.6 1.3 1.4 1.8 2.6c.5-1.2 1.1-2 1.8-2.6'
    + 'M6.4 30.2Q32 36.6 57.6 30.2M5 34.6Q32 41.6 59 34.6M5 37.2Q32 44.8 59 37.2',
  /** Light catching the left edge of each point. */
  highlight: 'M3.4 17.6c1.7 2.8 3.5 5 5.6 6.4M17 12.4c-1 3.6-2.6 7-4.8 9.4M32 7.2c-1.2 5.6-3 10.6-5.6 13.8M47 12.4c-1 3.6-2.6 7-4.8 9.4',
};

type Size = 'compact' | 'medium' | 'large';

export function CrownMark({ size = 'medium', className = 'crown' }: { size?: Size; className?: string }) {
  const g = CROWN_GEOMETRY; const fine = size !== 'compact';
  return (
    <svg className={className} viewBox={g.viewBox} aria-hidden="true" focusable="false" data-size={size}>
      <defs>
        <linearGradient id="bkp-crown-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--crown-highlight)" /><stop offset=".45" stopColor="var(--crown-gold)" /><stop offset="1" stopColor="var(--crown-deep)" />
        </linearGradient>
      </defs>
      <path d={g.inner} fill="var(--crown-shadow)" />
      <path d={g.body} fill="url(#bkp-crown-gold)" stroke="var(--crown-shadow)" strokeWidth={fine ? 0.5 : 0.9} strokeLinejoin="round" />
      <path d={g.band} fill="var(--crown-gold)" stroke="var(--crown-shadow)" strokeWidth={fine ? 0.5 : 0.9} strokeLinejoin="round" />
      <path d={g.finial} fill="var(--crown-highlight)" stroke="var(--crown-shadow)" strokeWidth={fine ? 0.45 : 0.8} strokeLinejoin="round" />
      {g.pearls.map(([x, y]) => <circle key={x} cx={x} cy={y} r={fine ? 1.5 : 1.8} fill="var(--crown-gold)" stroke="var(--crown-shadow)" strokeWidth={fine ? 0.45 : 0.8} />)}
      {fine && <path d={g.engraving} fill="none" stroke="var(--crown-shadow)" strokeWidth=".5" strokeLinecap="round" opacity=".8" />}
      {fine && <path d={g.highlight} fill="none" stroke="var(--crown-highlight)" strokeWidth=".7" strokeLinecap="round" opacity=".9" />}
      {g.jewels.map(([x, y, r]) => <circle key={x} cx={x} cy={y} r={fine ? r : r + 0.2} fill="var(--crown-shadow)" />)}
    </svg>
  );
}

/** Back-compatible name used across the app. */
export function Crown({ className = 'crown', variant = 'full' }: { className?: string; variant?: 'full' | 'compact' }) {
  return <CrownMark className={className} size={variant === 'compact' ? 'compact' : 'large'} />;
}

/** Past champions and Hall of Fame records: the same silhouette in outline, never gold. */
export function PastChampionMark({ label }: { label: string }) {
  return (
    <span className="past-mark">
      <svg viewBox={CROWN_GEOMETRY.viewBox} aria-hidden="true" focusable="false">
        <path d={CROWN_GEOMETRY.body} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
        <path d={CROWN_GEOMETRY.band} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      </svg>
      {label}
    </span>
  );
}

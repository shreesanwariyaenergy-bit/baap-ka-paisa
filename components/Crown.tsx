// The official BAAP KA PAISA crown. One unisex mark, refined from the prototype's crown geometry:
// three points with round finials over a solid band. Gold is used for this mark and nothing else.
export const CROWN_GEOMETRY = {
  viewBox: '-1.5 -1.5 43 28',
  body: 'M4 18.6 2.6 6.9 12 12.5 20 3.6 28 12.5 37.4 6.9 36 18.6Z',
  finials: [[2.6, 5.5, 1.75], [20, 2.2, 1.95], [37.4, 5.5, 1.75]] as const,
  band: { x: 3.4, y: 18.6, w: 33.2, h: 4.8 },
  highlight: 'M5.8 20.5H34.2',
  /** Three engraved lozenges on the band: the signature detail at large sizes. */
  lozenges: [11.5, 20, 28.5] as const,
};

/**
 * `full` for large displays (leader panel, Seal, share image). `compact` for ranking rows:
 * heavier outline and no hairline highlight, so it stays crisp at 24–34px.
 */
export function Crown({ className = 'crown', variant = 'full' }: { className?: string; variant?: 'full' | 'compact' }) {
  const g = CROWN_GEOMETRY;
  const sw = variant === 'compact' ? 1.7 : 1.25;
  return (
    <svg className={className} viewBox={g.viewBox} aria-hidden="true" focusable="false" data-variant={variant}>
      <path d={g.body} fill="var(--crown-gold)" stroke="var(--crown-shadow)" strokeWidth={sw} strokeLinejoin="round" />
      {g.finials.map(([cx, cy, r]) => <circle key={cx} cx={cx} cy={cy} r={variant === 'compact' ? r + 0.25 : r} fill="var(--crown-gold)" stroke="var(--crown-shadow)" strokeWidth={sw * 0.75} />)}
      <rect x={g.band.x} y={g.band.y} width={g.band.w} height={g.band.h} rx="0.8" fill="var(--crown-gold)" stroke="var(--crown-shadow)" strokeWidth={sw} />
      {variant === 'full' && <path d={g.highlight} stroke="var(--crown-highlight)" strokeWidth="0.9" strokeLinecap="round" />}
      {variant === 'full' && g.lozenges.map((x) => <path key={x} d={`M${x} 20.1 ${x + 1.5} 21.6 ${x} 23.1 ${x - 1.5} 21.6Z`} fill="var(--crown-shadow)" />)}
    </svg>
  );
}

/** Past-season champion marker: outline only, ink colour, never gold. Distinct from the live crown. */
export function PastChampionMark({ label }: { label: string }) {
  return (
    <span className="past-mark">
      <svg viewBox="0 0 40 26" aria-hidden="true" focusable="false">
        <path d="M3.4 17.2 2.1 6.2 11.7 11.6 20 2.9 28.3 11.6 37.9 6.2 36.6 17.2Z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
        <rect x="3" y="19.3" width="34" height="4.6" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      {label}
    </span>
  );
}

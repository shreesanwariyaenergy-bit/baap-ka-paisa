// The official BAAP KA PAISA crown. One unisex mark, refined from the prototype's crown geometry:
// three points with round finials over a solid band. Gold is used for this mark and nothing else.
export function Crown({ className = 'crown' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 26" aria-hidden="true" focusable="false">
      <path d="M3.4 17.2 2.1 6.2 11.7 11.6 20 2.9 28.3 11.6 37.9 6.2 36.6 17.2Z" fill="var(--crown-gold)" stroke="var(--crown-shadow)" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="2.1" cy="5.4" r="1.75" fill="var(--crown-gold)" stroke="var(--crown-shadow)" strokeWidth="0.9" />
      <circle cx="20" cy="2.2" r="1.95" fill="var(--crown-gold)" stroke="var(--crown-shadow)" strokeWidth="0.9" />
      <circle cx="37.9" cy="5.4" r="1.75" fill="var(--crown-gold)" stroke="var(--crown-shadow)" strokeWidth="0.9" />
      <rect x="3" y="19.3" width="34" height="4.6" rx="0.8" fill="var(--crown-gold)" stroke="var(--crown-shadow)" strokeWidth="1.1" />
      <path d="M5.2 20.7H34.8" stroke="var(--crown-highlight)" strokeWidth="0.9" strokeLinecap="round" />
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

// Shown the moment a link is clicked, while the server prepares the next page (used by each section's loading.tsx).
// Not used on pages that can answer "not found" or redirect: under a loading state those answers would be sent as
// a normal page instead of a 404 or a redirect. Those pages get the navigation bar (components/NavProgress.tsx) instead.
// The header and navigation stay
// in place; only the page area is replaced. Next.js also prefetches this shell for every link in view, so it
// appears without waiting on the network.
export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" data-loading="">
      <section className="page-intro"><div><div className="eyebrow skeleton" style={{ width: 160, height: 14 }} /><div className="skeleton" style={{ width: 'min(520px, 80%)', height: 'clamp(56px, 9vw, 120px)', marginTop: 14 }} /></div><p className="sr-only">Loading…</p></section>
      <div className="board-layout" style={{ marginTop: 23 }}>
        <div className="board-panel">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 66, borderBottom: '1px solid var(--line-soft)' }} />)}</div>
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    </div>
  );
}

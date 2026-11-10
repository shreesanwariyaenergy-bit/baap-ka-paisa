export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <section className="page-intro"><div><div className="eyebrow">The public record / 01</div><h1>The board.</h1></div><p>Loading the board…</p></section>
      <div className="board-layout" style={{ marginTop: 23 }}>
        <div className="board-panel">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 66, borderBottom: '1px solid var(--line-soft)' }} />)}</div>
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    </div>
  );
}

'use client';
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="page-intro" style={{ marginBottom: 70 }} role="alert">
      <div><div className="eyebrow">Something went wrong</div><h1>Board<br />unavailable.</h1></div>
      <p>The ranking data could not be loaded. Your standing has not changed. <button className="textlink" type="button" onClick={reset}>Try again</button></p>
    </section>
  );
}

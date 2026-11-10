'use client';
// Shown only if the page shell itself cannot load (for example the ranking service is unreachable).
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ margin: 0, background: '#F1EFE6', color: '#172B27', fontFamily: 'Karla, Arial, sans-serif', padding: '48px 24px' }}>
        <p style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: '#24584C' }}>BAAP KA PAISA</p>
        <h1 style={{ fontFamily: '"Barlow Condensed", "Arial Narrow", sans-serif', fontSize: 64, lineHeight: .9, textTransform: 'uppercase', margin: '12px 0' }}>Register<br />unavailable.</h1>
        <p style={{ maxWidth: 420 }}>The ranking service could not be reached. Nothing has changed on the boards. Try again in a moment.</p>
        <button type="button" onClick={reset} style={{ background: '#183F37', color: '#FFFDF7', border: 0, padding: '14px 18px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '.1em', cursor: 'pointer' }}>Try again</button>
      </body>
    </html>
  );
}

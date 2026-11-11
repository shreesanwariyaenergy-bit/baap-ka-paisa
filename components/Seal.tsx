'use client';
// The Seal: permanent member identity with a front and a reverse. Replaces the old "My Card".
// It is deliberately not card-shaped and carries no chip: it is a membership seal, not a payment card.
import { useState } from 'react';
import { Crown } from './Crown';

export interface SealFront { brandLine: string; memberNo: string; name: string; location: string; rank: string; rankIsFirst: boolean; scopeLine: string; season: string; marks?: string[]; }
export interface SealBack { records: { rank: string; text: string; when: string }[]; insignia: string[]; lifetime: string; memberNo: string; bestRank?: string; territory?: { label: string; rank: string }[]; qr?: { svg: string; caption: string } }

function Emboss() {
  return (
    <svg className="seal-emboss" viewBox="0 0 80 80" aria-hidden="true" focusable="false">
      <circle cx="40" cy="40" r="37" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="40" cy="40" r="29" fill="none" stroke="currentColor" strokeWidth="0.8" strokeDasharray="1.5 2.5" />
      <text x="40" y="47" textAnchor="middle" fontFamily="var(--font-changa), 'Changa One', sans-serif" fontSize="20" fill="currentColor">B₹</text>
    </svg>
  );
}

export function Seal({ front, back }: { front: SealFront; back: SealBack }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <>
      <div className="seal-stage">
        <button type="button" className={`seal-object${flipped ? ' is-flipped' : ''}`} aria-pressed={flipped} onClick={() => setFlipped((f) => !f)}
          aria-label={flipped ? 'The Seal, reverse side. Select to show the front.' : 'The Seal, front side. Select to show the reverse.'} data-testid="seal">
          <span className="seal-face seal-front" aria-hidden={flipped}>
            <span className="seal-top"><span className="seal-brand">BAAP KA PAISA<small>The Seal / permanent identity</small></span><Emboss /></span>
            <span className="seal-main">
              <span className="seal-rank">{front.rankIsFirst && <Crown />}{front.rank}</span>
              <span style={{ minWidth: 0 }}><span className="seal-name" style={{ display: 'block' }}>{front.name}</span><span className="seal-location" style={{ display: 'block' }}>{front.scopeLine}</span><span className="seal-location" style={{ display: 'block' }}>{front.location}</span></span>
            </span>
            <span className="seal-id"><small>Permanent member ID</small><b>{front.memberNo}</b>{front.marks && front.marks.length > 0 && <span className="seal-insignia" style={{ marginTop: 8 }}>{front.marks.map((m) => <span key={m}>{m}</span>)}</span>}</span>
            <span className="seal-bottom"><span>The Seal</span><strong>{front.season}</strong><span>The record stays</span></span>
          </span>
          <span className="seal-face seal-back" aria-hidden={!flipped}>
            <span className="seal-top"><span className="seal-brand">THE SEAL<small>Reverse / your record</small></span><span>No. {back.memberNo}</span></span>
            <span className="seal-back-grid" style={{ display: 'grid', gridTemplateColumns: back.qr ? 'minmax(0,1fr) auto' : '1fr', gap: 14, alignItems: 'end', position: 'relative', zIndex: 1 }}>
            <span className="seal-records">
              <span className="seal-back-title" style={{ display: 'block', font: 'clamp(20px,2.6vw,30px) var(--font-brand)', textTransform: 'uppercase', marginBottom: 10, color: 'var(--lime)' }}>The record stays.</span>
              {back.bestRank && <span className="seal-record"><b>{back.bestRank}</b><span>Best city finish on record</span><small>Best</small></span>}
              {back.territory?.map((t) => <span className="seal-record" key={t.label}><b>{t.rank}</b><span>{t.label}</span><small>Now</small></span>)}
              {back.records.length === 0 && <span className="seal-record"><b>—</b><span>No finished seasons yet</span><small>&nbsp;</small></span>}
              {back.records.map((r) => <span className="seal-record" key={r.when + r.text}><b>{r.rank}</b><span>{r.text}</span><small>{r.when}</small></span>)}
            </span>
            {back.qr && <span style={{ display: 'grid', justifyItems: 'center', gap: 4 }}><span className="qr" dangerouslySetInnerHTML={{ __html: back.qr.svg }} data-testid="seal-qr" /><small style={{ font: '8px var(--font-mono)', color: '#AEB9AF', textTransform: 'uppercase', maxWidth: 110, textAlign: 'center' }}>{back.qr.caption}</small></span>}
            </span>
            <span className="seal-insignia">{back.insignia.map((i) => <span key={i}>{i}</span>)}</span>
            <span className="seal-bottom"><span>Lifetime score {back.lifetime}</span><strong>Identity no. {back.memberNo}</strong></span>
          </span>
        </button>
      </div>
      <div className="seal-controls">
        <span>Permanent member identity · rankings can change</span>
        <button type="button" onClick={() => setFlipped((f) => !f)} data-testid="flip-seal">Flip the seal ↻</button>
      </div>
    </>
  );
}

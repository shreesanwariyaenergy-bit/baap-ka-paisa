import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LEGAL_DOCS } from '@/lib/legal';

export function generateStaticParams() { return LEGAL_DOCS.map((d) => ({ slug: d.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = LEGAL_DOCS.find((d) => d.slug === slug);
  return { title: doc ? `${doc.title} (draft)` : 'Not found' };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = LEGAL_DOCS.find((d) => d.slug === slug);
  if (!doc) notFound();
  return (
    <>
      <section className="page-intro">
        <div><div className="eyebrow">The fine print</div><h1>{doc.title}.</h1></div>
        <p>{doc.summary}</p>
      </section>
      <p className="notice" role="note" data-testid="legal-draft"><b>DRAFT — LEGAL REVIEW REQUIRED.</b> This page outlines rules from the product blueprint. It is not final legal text and does not claim compliance with any law.</p>
      <div className="profile-wrap" style={{ marginTop: 10 }}>
        <div>
          {doc.sections.map((s) => (
            <div className="history" key={s.heading}>
              <h3>{s.heading}</h3>
              {s.points.map((p) => <div className="history-row" key={p} style={{ gridTemplateColumns: '18px 1fr' }}><b aria-hidden="true" style={{ fontSize: 16 }}>—</b><span>{p}</span></div>)}
            </div>
          ))}
        </div>
        <nav className="history" aria-label="Policies" style={{ alignSelf: 'start', marginTop: 14 }}>
          <h3>Policies</h3>
          {LEGAL_DOCS.map((d) => <Link key={d.slug} className="history-row" href={`/legal/${d.slug}`} aria-current={d.slug === doc.slug ? 'page' : undefined} style={{ gridTemplateColumns: '1fr auto' }}><span>{d.title}</span><small>{d.slug === doc.slug ? 'Viewing' : 'Open ↗'}</small></Link>)}
        </nav>
      </div>
    </>
  );
}

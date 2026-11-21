import type { Metadata } from 'next';
import { NOINDEX } from '@/lib/seo';
import { notFound } from 'next/navigation';
import { LEGAL_DOCS } from '@/lib/legal';

export function generateStaticParams() { return LEGAL_DOCS.map((d) => ({ slug: d.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = LEGAL_DOCS.find((d) => d.slug === slug);
  return { title: doc ? doc.fullTitle : 'Not found', robots: NOINDEX };   // policies stay out of search results
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
      <article className="legal-copy" data-testid="legal-text" aria-label={doc.fullTitle}>
        {doc.sections.map((s) => (
          <section key={s.heading}>
            <h2>{s.heading}</h2>
            {s.paragraphs.map((p) => <p key={p}>{p}</p>)}
          </section>
        ))}
      </article>
    </>
  );
}

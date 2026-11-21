import type { Metadata } from 'next';
import { NOINDEX } from '@/lib/seo';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LEGAL_DOCS } from '@/lib/legal';

export function generateStaticParams() { return LEGAL_DOCS.map((d) => ({ slug: d.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = LEGAL_DOCS.find((d) => d.slug === slug);
  return { title: doc ? doc.title : 'Not found', robots: NOINDEX };   // policies stay out of search results until legal review is complete
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = LEGAL_DOCS.find((d) => d.slug === slug);
  if (!doc) notFound();
  return (
    <>
      <section className="page-intro">
        <div><div className="eyebrow">The fine print</div><h1 className="legal-title">{doc.title}</h1></div>
        <p>{doc.summary}</p>
      </section>
      <p className="notice" role="note" data-testid="legal-status"><b>Pending legal review.</b> Payments are not open yet: rank purchases stay switched off until payment-provider approval is in place, and the payment terms on this page apply only once payments open.</p>
      <div className="profile-wrap legal-wrap">
        <article className="history legal-text" data-testid="legal-text">
          <p className="legal-meta">Operated by VEXOR LABS · Effective date: {doc.effective ?? <span className="legal-pending">to be set on publication</span>}</p>
          <ol className="legal-sections">
            {doc.sections.map((s, i) => (
              <li key={s.heading} id={`section-${i + 1}`}>
                <h2><span className="legal-no" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>{s.heading}</h2>
                {s.paragraphs.map((p) => <p key={p}>{p}</p>)}
              </li>
            ))}
          </ol>
          {doc.contact && (
            <section className="legal-contact-block" aria-labelledby="grievance-contact">
              <h2 id="grievance-contact">Grievance contact details</h2>
              <dl className="legal-contact" data-testid="legal-contact">
                {doc.contact.map((c) => (
                  <div key={c.label}><dt>{c.label}</dt><dd>{c.value ?? <span className="legal-pending">To be published here</span>}</dd></div>
                ))}
              </dl>
            </section>
          )}
        </article>
        <nav className="history legal-nav" aria-label="Policies">
          <h3>Policies</h3>
          {LEGAL_DOCS.map((d) => <Link key={d.slug} className="history-row" href={`/legal/${d.slug}`} aria-current={d.slug === doc.slug ? 'page' : undefined} style={{ gridTemplateColumns: '1fr auto' }}><span>{d.title}</span><small>{d.slug === doc.slug ? 'Viewing' : 'Open ↗'}</small></Link>)}
        </nav>
      </div>
    </>
  );
}

// Renders schema.org JSON-LD into the server-rendered page. The data comes from lib/seo.ts (no user input), and
// "<" is escaped so the content can never close the script element.
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}

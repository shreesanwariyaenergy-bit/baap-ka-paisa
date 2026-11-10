import Link from 'next/link';
export default function NotFound() {
  return (
    <section className="page-intro" style={{ marginBottom: 70 }}>
      <div><div className="eyebrow">Not in the register</div><h1>Nothing<br />here.</h1></div>
      <p>This page or member does not exist. Check the link, or <Link href="/board" style={{ textDecoration: 'underline' }}>go to the board</Link>.</p>
    </section>
  );
}

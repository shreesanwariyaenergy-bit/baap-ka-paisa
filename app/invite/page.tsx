import type { Metadata } from 'next';
import Link from 'next/link';
import { getDataSource } from '@/lib/data';
import { CopyLink } from '@/components/CopyLink';

export const metadata: Metadata = { title: 'Invite' };

export default async function InvitePage() {
  const ds = await getDataSource();
  const viewer = await ds.viewer();
  return (
    <>
      <section className="page-intro">
        <div><div className="eyebrow">Invite</div><h1>Bring your<br />rivals.</h1></div>
        <p>A board is only worth topping if the right people are on it. Send your link to the friends you want to beat.</p>
      </section>
      <div className="wizard"><div className="wizard-card">
        {viewer ? <>
          <h2>Your invite link</h2>
          <p>Anyone who creates a profile from this link is recorded as invited by you. There is no reward for inviting: no credit, no rank, no money.</p>
          <CopyLink path={`/join?ref=${encodeURIComponent(viewer.member.username)}`} shareText="I'm on the BAAP KA PAISA register. Come and try to pass me." />
        </> : <>
          <h2>Create a profile first</h2>
          <p>Your invite link is tied to your username.</p>
          <Link className="btn" href="/join">Create your profile <span className="arrow" aria-hidden="true">↗</span></Link>
        </>}
      </div></div>
    </>
  );
}

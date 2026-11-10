import type { Metadata } from 'next';
import { getDataSource } from '@/lib/data';
import { CITIES } from '@/lib/geo';
import { JoinForm } from '@/components/ProfileForms';

export const metadata: Metadata = { title: 'Join' };

export default async function JoinPage() {
  const ds = await getDataSource();
  return (
    <>
      <section className="page-intro">
        <div><div className="eyebrow">Onboarding / preview</div><h1>Claim your<br />place.</h1></div>
        <p>Pick your city and locality, choose how you appear, and see your profile before you join. Sign-up is not open yet: your details are checked on the server and then discarded. Nothing is stored and no account is created.</p>
      </section>
      {ds.availability === 'demo' && <p className="notice"><b>Demo.</b> You are browsing as the demo member. This page previews the sign-up flow for a new member.</p>}
      <JoinForm cities={CITIES.map((c) => ({ id: c.id, name: c.name, localities: c.localities }))} />
    </>
  );
}

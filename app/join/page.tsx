import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getDataSource } from '@/lib/data';
import { CITIES } from '@/lib/geo';
import { currentAccount } from '@/lib/supabase-server';
import { JoinWizard } from '@/components/JoinWizard';

export const metadata: Metadata = { title: 'Create your profile' };

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const sp = await searchParams;
  const ds = await getDataSource();
  const live = ds.availability === 'live';
  if (live && (await ds.viewer())) redirect('/seal');
  const account = live ? await currentAccount() : null;
  const ref = /^[a-z0-9._]{3,24}$/.test(sp.ref ?? '') && (await ds.member(sp.ref!)) ? sp.ref! : null;
  return (
    <>
      <section className="page-intro" style={{ borderBottom: 0, paddingBottom: 0 }}>
        <div><div className="eyebrow">Join the register</div><h1>Claim your<br />place.</h1></div>
        <p>Free to create. Pick your city and locality, get a permanent member ID and your own Seal. Takes about a minute.</p>
      </section>
      {!live && <p className="notice"><b>Demo site.</b> Registration runs in test mode here: every check is real, but no account is created and nothing is stored.</p>}
      <JoinWizard cities={CITIES.map((c) => ({ id: c.id, name: c.name, localities: c.localities }))} live={live} hasAccount={!!account} accountEmail={account?.email ?? null} referrer={ref} />
    </>
  );
}

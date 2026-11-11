import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDataSource } from '@/lib/data';
import { SignInForm } from '@/components/SignInForm';

export const metadata: Metadata = { title: 'Sign in' };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ confirmed?: string }> }) {
  const sp = await searchParams;
  const ds = await getDataSource();
  if (await ds.viewer()) redirect('/seal');
  const demo = ds.availability !== 'live';
  return (
    <div className="wizard">
      <div className="wizard-card">
        <div className="eyebrow">Members</div>
        <h2 style={{ marginTop: 12 }}>Sign in.</h2>
        <p>{demo ? 'This is the demo site. Accounts are not created here, so you can look around as the demo member instead.' : 'Welcome back. Your rank has probably moved.'}</p>
        {sp.confirmed === 'check' && <p className="notice warn">That confirmation link has expired or was already used. If you confirmed your email, sign in below.</p>}
        <SignInForm demo={demo} />
        <p style={{ marginTop: 18 }}>New here? <Link href="/join" style={{ textDecoration: 'underline', fontWeight: 700 }}>Create your profile</Link></p>
      </div>
    </div>
  );
}

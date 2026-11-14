'use client';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import { signIn, type SignInResult } from '@/app/auth-actions';

export function SignInForm({ demo }: { demo: boolean }) {
  const [res, action, pending] = useActionState<SignInResult | null, FormData>(signIn, null);
  const [email, setEmail] = useState(''); // kept after a failed attempt
  return (
    <form action={action} noValidate>
      {!demo && <>
        <label className="field"><span className="field-label">Email</span><input name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="field"><span className="field-label">Password</span><input name="password" type="password" autoComplete="current-password" required /></label>
        <p style={{ margin: '8px 0 0', fontSize: 14 }}><Link href="/forgot" style={{ textDecoration: 'underline' }}>Forgot your password?</Link></p>
      </>}
      {res && !res.ok && <p className="field-error" role="alert" style={{ marginTop: 6 }}>{res.message}</p>}
      <button className="btn" type="submit" disabled={pending} style={{ marginTop: 12 }} data-testid="signin-submit">{pending ? 'Signing in…' : demo ? 'Continue as the demo member' : 'Sign in'} <span className="arrow" aria-hidden="true">↗</span></button>
    </form>
  );
}

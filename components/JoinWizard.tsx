'use client';
// First-visit registration: account → profile → eligibility → preview → done.
// Every step is checked on the server (validateStep); the final submit re-checks everything (register).
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { register, validateStep, type RegErrors, type RegInput, type RegResult } from '@/app/auth-actions';

interface CityOpt { id: string; name: string; localities: readonly string[] }
const STEPS = ['Account', 'Profile', 'Eligibility', 'Preview', 'Done'];
const Err = ({ e }: { e?: string }) => (e ? <span className="field-error" role="alert">{e}</span> : null);

export function JoinWizard({ cities, live, hasAccount, accountEmail, referrer }: { cities: CityOpt[]; live: boolean; hasAccount: boolean; accountEmail: string | null; referrer: string | null }) {
  const [step, setStep] = useState(hasAccount ? 2 : 1);
  const [d, setD] = useState<RegInput>({ email: '', password: '', confirm: '', displayName: '', username: '', cityId: cities[0].id, locality: '', flexLine: '', dateOfBirth: '', adult: false, terms: false, mystery: false, hasAccount });
  const [errors, setErrors] = useState<RegErrors>({});
  const [result, setResult] = useState<RegResult | null>(null);
  const [pending, start] = useTransition();
  const set = (patch: Partial<RegInput>) => setD((x) => ({ ...x, ...patch }));
  const city = cities.find((c) => c.id === d.cityId)!;

  const next = () => start(async () => {
    const e = await validateStep(step as 1 | 2 | 3, d);
    setErrors(e);
    if (Object.keys(e).length === 0) setStep(step + 1);
  });
  const submit = () => start(async () => {
    const r = await register({ ...d, title: '', referredBy: referrer ?? undefined });
    setResult(r); setErrors(r.errors);
    if (r.ok) setStep(5);
    else if (r.errors.email || r.errors.password || r.errors.confirm) setStep(1);
    else if (r.errors.username || r.errors.displayName || r.errors.locality || r.errors.cityId) setStep(2);
    else if (r.errors.dateOfBirth || r.errors.adult || r.errors.terms) setStep(3);
  });

  return (
    <div className="wizard">
      <ol className="wizard-steps" aria-label="Registration steps">
        {STEPS.map((s, i) => <li key={s} className={i + 1 < step ? 'done' : ''} aria-current={i + 1 === step ? 'step' : undefined}><b>{i + 1}</b><span>{s}</span></li>)}
      </ol>
      <div className="wizard-card" data-testid={`wizard-step-${step}`}>
        {step === 1 && <>
          <h2>Create your account.</h2>
          <p>Your email is only for signing in. It is never shown on the register.{!live && ' Demo site: you can try the whole flow, but no account is created.'}</p>
          <label className="field"><span className="field-label">Email address</span><input type="email" autoComplete="email" value={d.email} onChange={(e) => set({ email: e.target.value })} aria-invalid={!!errors.email} data-testid="f-email" /></label><Err e={errors.email} />
          <label className="field"><span className="field-label">Password</span><input type="password" autoComplete="new-password" value={d.password} onChange={(e) => set({ password: e.target.value })} aria-invalid={!!errors.password} data-testid="f-password" /><span className="field-hint">At least 8 characters, with a letter and a number.</span></label><Err e={errors.password} />
          <label className="field"><span className="field-label">Confirm password</span><input type="password" autoComplete="new-password" value={d.confirm} onChange={(e) => set({ confirm: e.target.value })} aria-invalid={!!errors.confirm} data-testid="f-confirm" /></label><Err e={errors.confirm} />
          <p style={{ marginTop: 14 }}>Already a member? <Link href="/signin" style={{ textDecoration: 'underline', fontWeight: 700 }}>Sign in</Link></p>
        </>}
        {step === 2 && <>
          <h2>Create your profile.</h2>
          <p>{hasAccount && accountEmail ? `Signed in as ${accountEmail}. ` : ''}This is how the register will know you.</p>
          <label className="field"><span className="field-label">Display name</span><input maxLength={40} value={d.displayName} onChange={(e) => set({ displayName: e.target.value })} aria-invalid={!!errors.displayName} data-testid="f-name" /></label><Err e={errors.displayName} />
          <label className="field"><span className="field-label">Username</span><input maxLength={24} autoCapitalize="none" value={d.username} onChange={(e) => set({ username: e.target.value.toLowerCase().replace(/\s/g, '') })} aria-invalid={!!errors.username} data-testid="f-username" /><span className="field-hint">3–24 characters: lowercase letters, numbers, dots, underscores. This is your public link.</span></label><Err e={errors.username} />
          <label className="field"><span className="field-label">City</span><select value={d.cityId} onChange={(e) => set({ cityId: e.target.value, locality: '' })} data-testid="f-city">{cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><Err e={errors.cityId} />
          <label className="field"><span className="field-label">Locality</span><select value={d.locality} onChange={(e) => set({ locality: e.target.value })} aria-invalid={!!errors.locality} data-testid="f-locality"><option value="">Choose your locality</option>{city.localities.map((l) => <option key={l}>{l}</option>)}</select><span className="field-hint">City and locality lock for 90 days after you join.</span></label><Err e={errors.locality} />
          <label className="field"><span className="field-label">Flex line, optional ({(d.flexLine ?? '').length}/40)</span><input maxLength={40} value={d.flexLine} onChange={(e) => set({ flexLine: e.target.value })} aria-invalid={!!errors.flexLine} /></label><Err e={errors.flexLine} />
          <label className="check"><input type="checkbox" checked={!!d.mystery} onChange={(e) => set({ mystery: e.target.checked })} /><span><b>Mystery mode.</b> Rank as ANON until you choose to reveal yourself.</span></label>
        </>}
        {step === 3 && <>
          <h2>Eligibility.</h2>
          <p>BAAP KA PAISA is for adults only.</p>
          <label className="field"><span className="field-label">Date of birth</span><input type="date" value={d.dateOfBirth} onChange={(e) => set({ dateOfBirth: e.target.value })} aria-invalid={!!errors.dateOfBirth} data-testid="f-dob" /><span className="field-hint">Used only to confirm you are 18 or older. Never shown publicly.</span></label><Err e={errors.dateOfBirth} />
          <label className="check"><input type="checkbox" checked={!!d.adult} onChange={(e) => set({ adult: e.target.checked })} data-testid="f-adult" /><span>I confirm that I am 18 years of age or older.</span></label><Err e={errors.adult} />
          <label className="check"><input type="checkbox" checked={!!d.terms} onChange={(e) => set({ terms: e.target.checked })} data-testid="f-terms" /><span>I accept the <Link href="/legal/terms" target="_blank" style={{ textDecoration: 'underline' }}>Terms</Link> and <Link href="/legal/privacy" target="_blank" style={{ textDecoration: 'underline' }}>Privacy Notice</Link> (both currently drafts under legal review).</span></label><Err e={errors.terms} />
        </>}
        {step === 4 && <>
          <h2>Check your profile.</h2>
          <p>This is what goes on the register. Nothing is created until you confirm.</p>
          <div className="member-preview" data-testid="member-preview">
            <small>BAAP KA PAISA · member profile</small>
            <b>{d.mystery ? 'ANON' : d.displayName}</b>
            <span>{d.mystery ? 'Mystery mode · name hidden' : `@${d.username}`} · {d.locality}, {city.name}</span>
            {d.flexLine && !d.mystery && <span>“{d.flexLine}”</span>}
            <small>Member ID assigned when you join · rank appears when you enter a season</small>
          </div>
          {result && !result.ok && <p className="notice warn" role="alert">{result.message}</p>}
        </>}
        {step === 5 && result && <div data-testid="wizard-success">
          <h2>{result.outcome === 'created' ? 'You are on the register.' : result.outcome === 'confirm-email' ? 'Confirm your email.' : 'Test run complete.'}</h2>
          <p>{result.message}</p>
          {result.outcome === 'created' && result.memberNo != null && <><div className="field-label">Your permanent member ID</div><div className="success-id" data-testid="member-id">{String(result.memberNo).padStart(5, '0')}</div><p>This number is yours for good. Your rank will change; this will not.</p></>}
          <div className="wizard-nav" style={{ justifyContent: 'flex-start' }}>
            {result.outcome === 'created' && <Link className="btn" href="/seal">Open The Seal <span className="arrow" aria-hidden="true">↗</span></Link>}
            {result.outcome === 'confirm-email' && <Link className="btn" href="/signin">Go to sign in <span className="arrow" aria-hidden="true">↗</span></Link>}
            <Link className="btn light" href="/board">Explore the board</Link>
          </div>
        </div>}
        {step < 5 && (
          <div className="wizard-nav">
            {step > (hasAccount ? 2 : 1) ? <button type="button" className="btn light" onClick={() => setStep(step - 1)} disabled={pending}>Back</button> : <span />}
            {step < 4
              ? <button type="button" className="btn" onClick={next} disabled={pending} data-testid="wizard-next">{pending ? 'Checking…' : 'Continue'} <span className="arrow" aria-hidden="true">↗</span></button>
              : <button type="button" className="btn dark" onClick={submit} disabled={pending} data-testid="wizard-confirm">{pending ? 'Creating…' : 'Confirm and create profile'} <span className="arrow" aria-hidden="true">↗</span></button>}
          </div>
        )}
      </div>
      {referrer && step < 5 && <p className="hero-note" style={{ textAlign: 'center' }}>Invited by @{referrer}</p>}
    </div>
  );
}

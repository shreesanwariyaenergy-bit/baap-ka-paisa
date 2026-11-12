'use client';
import { useActionState } from 'react';
import { enterTesterCode } from '@/app/auth-actions';

/** Internal testers unlock registration on this device with the access code. */
export function TesterCodeForm() {
  const [state, action, pending] = useActionState(enterTesterCode, null);
  return (
    <form action={action} className="wizard-card" style={{ marginTop: 22, maxWidth: 420 }} data-testid="tester-form">
      <label className="field"><span className="field-label">Tester access code</span>
        <input name="code" type="password" autoComplete="off" required data-testid="tester-code" /></label>
      <div className="wizard-nav"><span className="share-status" role="status" aria-live="polite">{state?.message}</span>
        <button className="btn" type="submit" disabled={pending}>Unlock</button></div>
    </form>
  );
}

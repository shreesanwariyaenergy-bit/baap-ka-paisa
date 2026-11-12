'use client';
import { useActionState } from 'react';
import { requestPasswordReset, setNewPassword, type PasswordResult } from '@/app/auth-actions';

export function ForgotForm() {
  const [res, action, pending] = useActionState<PasswordResult | null, FormData>(requestPasswordReset, null);
  if (res?.ok) return <p className="notice" role="status" data-testid="reset-sent">{res.message}</p>;
  return (
    <form action={action} noValidate>
      <label className="field"><span className="field-label">Email</span><input name="email" type="email" autoComplete="email" required /></label>
      {res && <p className="field-error" role="alert" style={{ marginTop: 6 }}>{res.message}</p>}
      <button className="btn" type="submit" disabled={pending} style={{ marginTop: 12 }}>{pending ? 'Sending…' : 'Send reset link'}</button>
    </form>
  );
}

export function NewPasswordForm() {
  const [res, action, pending] = useActionState<PasswordResult | null, FormData>(setNewPassword, null);
  return (
    <form action={action} noValidate>
      <label className="field"><span className="field-label">New password</span><input name="password" type="password" autoComplete="new-password" required />
        <span className="field-hint">At least 8 characters, with a letter and a number.</span></label>
      <label className="field"><span className="field-label">Confirm new password</span><input name="confirm" type="password" autoComplete="new-password" required /></label>
      {res && <p className="field-error" role="alert" style={{ marginTop: 6 }}>{res.message}</p>}
      <button className="btn" type="submit" disabled={pending} style={{ marginTop: 12 }}>{pending ? 'Saving…' : 'Save new password'}</button>
    </form>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { ForgotForm } from '@/components/PasswordForms';

export const metadata: Metadata = { title: 'Reset your password' };

export default function ForgotPage() {
  return (
    <div className="wizard">
      <div className="wizard-card">
        <div className="eyebrow">Members</div>
        <h2 style={{ marginTop: 12 }}>Reset your password.</h2>
        <p>Enter the email you signed up with. We will send a link to set a new password.</p>
        <ForgotForm />
        <p style={{ marginTop: 18 }}><Link href="/signin" style={{ textDecoration: 'underline', fontWeight: 700 }}>Back to sign in</Link></p>
      </div>
    </div>
  );
}

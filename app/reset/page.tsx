import type { Metadata } from 'next';
import Link from 'next/link';
import { currentAccount } from '@/lib/supabase-server';
import { NewPasswordForm } from '@/components/PasswordForms';

export const metadata: Metadata = { title: 'Set a new password' };

export default async function ResetPage() {
  const account = await currentAccount();
  return (
    <div className="wizard">
      <div className="wizard-card">
        <div className="eyebrow">Members</div>
        <h2 style={{ marginTop: 12 }}>Set a new password.</h2>
        {account ? <><p>For {account.email}.</p><NewPasswordForm /></>
          : <p className="notice warn" data-testid="reset-expired">This reset link has expired or was opened on a different device. <Link href="/forgot" style={{ textDecoration: 'underline', fontWeight: 700 }}>Request a new one</Link>.</p>}
      </div>
    </div>
  );
}

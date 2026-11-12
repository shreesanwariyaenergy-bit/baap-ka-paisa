import 'server-only';
// Product email (not sign-in email: confirmation and password emails are sent by Supabase Auth,
// whose sender is set in the Supabase dashboard under Authentication → SMTP).
// Nothing in the app sends email yet. This is the single place a provider plugs in.
//   BKP_EMAIL_PROVIDER = resend        (only provider wired so far)
//   BKP_EMAIL_API_KEY  = provider key  (server only; never commit)
//   BKP_EMAIL_FROM     = "BAAP KA PAISA <hello@your-domain>"
export interface Email { to: string; subject: string; text: string; html?: string }
export type SendResult = { sent: true; id: string | null } | { sent: false; reason: 'not-configured' | 'provider-error'; detail?: string };

export function emailConfig() {
  const provider = process.env.BKP_EMAIL_PROVIDER, key = process.env.BKP_EMAIL_API_KEY, from = process.env.BKP_EMAIL_FROM;
  return provider === 'resend' && key && from ? { provider, key, from } : null;
}

/** Sends one email to one person. Returns not-configured (and sends nothing) until a provider is set. */
export async function sendEmail(mail: Email, fetcher: typeof fetch = fetch): Promise<SendResult> {
  const cfg = emailConfig();
  if (!cfg) return { sent: false, reason: 'not-configured' };
  try {
    const res = await fetcher('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: cfg.from, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
    });
    if (!res.ok) return { sent: false, reason: 'provider-error', detail: `HTTP ${res.status}` };
    const body = (await res.json().catch(() => ({}))) as { id?: string };
    return { sent: true, id: body.id ?? null };
  } catch (e) { return { sent: false, reason: 'provider-error', detail: e instanceof Error ? e.message : 'network' }; }
}

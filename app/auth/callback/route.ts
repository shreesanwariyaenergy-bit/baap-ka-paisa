// Lands here from the confirmation email. Confirms the account, creates the pending member profile, opens The Seal.
import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabaseAuth } from '@/lib/supabase-server';
import { ensureMember } from '@/app/auth-actions';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const sb = await supabaseAuth();
  const to = (path: string) => NextResponse.redirect(new URL(path, url.origin));
  if (!sb) return to('/');
  const code = url.searchParams.get('code'); const tokenHash = url.searchParams.get('token_hash'); const type = url.searchParams.get('type') as EmailOtpType | null;
  const { error } = code ? await sb.auth.exchangeCodeForSession(code)
    : tokenHash && type ? await sb.auth.verifyOtp({ token_hash: tokenHash, type })
    : { error: new Error('missing') };
  if (error) return to('/signin?confirmed=check');
  const state = await ensureMember();
  return to(state === 'needs-profile' ? '/join?complete=1' : '/seal?welcome=1');
}

import 'server-only';
// Demo-only social state for the signed-in demo member, kept in a cookie on this browser.
// It never reaches the database and disappears when the cookie is cleared.
import { cookies } from 'next/headers';

export interface DemoSocial { follows: string[]; rivals: string[]; respected: Record<string, number>; }
const NAME = 'bkp_demo_social';

export async function readDemoSocial(defaults: DemoSocial): Promise<DemoSocial> {
  try {
    const raw = (await cookies()).get(NAME)?.value;
    if (!raw) return defaults;
    const v = JSON.parse(raw) as DemoSocial;
    if (!Array.isArray(v.follows) || !Array.isArray(v.rivals) || typeof v.respected !== 'object') return defaults;
    return { follows: v.follows.slice(0, 200).map(String), rivals: v.rivals.slice(0, 5).map(String), respected: v.respected };
  } catch { return defaults; }
}

export async function writeDemoSocial(v: DemoSocial) {
  (await cookies()).set(NAME, JSON.stringify(v), { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 });
}

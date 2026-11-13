import type { Metadata } from 'next';
import Link from 'next/link';
import { getDataSource } from '@/lib/data';
import { myBlocks } from '@/app/actions';
import { BlockButton } from '@/components/BlockButton';
import { cityById } from '@/lib/geo';
import { inr, pad2 } from '@/lib/format';
import { placeLockedUntil } from '@/lib/profile-rules';
import { readDemoSocial } from '@/lib/demo-social';
import { EditProfileForm } from '@/components/ProfileForms';

export const metadata: Metadata = { title: 'Edit profile' };

export default async function MePage() {
  const ds = await getDataSource();
  const viewer = await ds.viewer();
  const intro = (
    <section className="page-intro">
      <div><div className="eyebrow">Me / profile</div><h1>Your<br />profile.</h1></div>
      <p>Change how you appear on the boards, who sees your socials, and whether you rank in Mystery mode.</p>
    </section>
  );
  if (!viewer) {
    return (<>{intro}<div className="board-panel" style={{ margin: '26px 0 70px' }}><div className="state-box" data-testid="me-signed-out"><h4>Sign in to edit your profile.</h4><p><Link href="/signin" style={{ textDecoration: 'underline' }}>Sign in</Link> or <Link href="/join" style={{ textDecoration: 'underline' }}>create your profile</Link>.</p></div></div></>);
  }
  const m = viewer.member;
  const city = cityById(m.cityId)!;
  const social = await ds.social(m.username);
  const [handles, blocks] = await Promise.all([ds.socials(m.username), ds.availability === 'live' ? myBlocks() : []]);
  const st = await readDemoSocial({ follows: [], rivals: social?.rivals.map((r) => r.member.username) ?? [], respected: {} });
  const rivals = await Promise.all(st.rivals.map(async (u) => ({ m: await ds.member(u), s: (await ds.standings(u)).find((x) => x.level === 'city') })));
  const lockDate = placeLockedUntil(new Date('2026-08-09T00:00:00+05:30')); // demo member joined 9 Aug 2026
  const lockedUntil = lockDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  return (
    <>
      {intro}
      <div className="profile-wrap">
        <EditProfileForm socials={handles ? { instagram: handles.instagram ?? '', snapchat: handles.snapchat ?? '', vis: handles.visibility ?? 'nobody' } : undefined} demo={ds.availability === 'demo'} place={{ label: `${m.locality}, ${city.name}`, lockedUntil, locked: lockDate > ds.now() }}
          initial={{ displayName: m.displayName ?? '', username: m.username, title: m.title ?? '', flexLine: m.flexLine ?? '', mystery: m.masked, locality: m.locality }} />
        <div>
          {blocks.length > 0 && (
            <div className="history" style={{ marginTop: 0 }} data-testid="block-list"><h3>Blocked challengers</h3>
              {blocks.map((b) => <div key={b.name} style={{ margin: '8px 0' }}><BlockButton name={b.name} label={b.label} blocked /></div>)}
            </div>
          )}
          <div className="history" style={{ marginTop: 26 }} data-testid="rival-strip">
            <h3>Your rivals ({st.rivals.length}/5)</h3>
            {rivals.length === 0 && <p>No rivals yet. Add them from any profile.</p>}
            {rivals.map(({ m: r, s }) => r && (
              <Link className="history-row" key={r.username} href={`/u/${encodeURIComponent(r.username)}`}><b>{s?.rank ? `#${pad2(s.rank)}` : '—'}</b><span>{r.masked ? r.publicLabel : r.displayName} · {cityById(r.cityId)?.name}</span><small>{inr(r.seasonScore)}</small></Link>
            ))}
          </div>
          <div className="history"><h3>Your Army</h3>
            <div className="history-row"><b>{social?.followers ?? 0}</b><span>Followers</span><small>Army</small></div>
            <div className="history-row"><b>{(social?.following ?? 0) + st.follows.length}</b><span>Following</span><small>{st.follows.length ? `${st.follows.length} added in this demo` : ''}</small></div>
            <div className="history-row"><b>{social?.respectThisSeason ?? 0}</b><span>Respect received this season</span><small>Free</small></div>
          </div>
          <div className="history"><h3>Privacy</h3><p>Phone number, exact address, date of birth and live location are never shown. Account deletion and notification settings arrive with sign-in.</p></div>
        </div>
      </div>
    </>
  );
}

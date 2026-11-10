'use client';
import { startTransition, useActionState, useState } from 'react';
import { previewSignup, saveProfile, type FormResult } from '@/app/actions';
import { TITLES } from '@/lib/profile-rules';

interface CityOpt { id: string; name: string; localities: readonly string[] }
const Err = ({ e }: { e?: string }) => (e ? <span className="field-error" role="alert">{e}</span> : null);

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="field"><span className="field-label">{label}</span>{children}{hint && <span className="field-hint">{hint}</span>}</label>;
}

function MysteryPreview({ on, name, username, locality }: { on: boolean; name: string; username: string; locality: string }) {
  return (
    <div className="preview-row" aria-live="polite" data-testid="mystery-preview">
      <span className="rank-avatar">{on ? 'xx' : (name || '?').slice(0, 2).toUpperCase()}</span>
      <span><b>{on ? 'ANON-xx' : name || 'Your name'}</b><small>{on ? `Mystery mode · ${locality || 'your locality'}` : `@${username || 'username'} · ${locality || 'your locality'}`}</small></span>
    </div>
  );
}

export function JoinForm({ cities }: { cities: CityOpt[] }) {
  const [res, action, pending] = useActionState<FormResult | null, FormData>(previewSignup, null);
  const [city, setCity] = useState(cities[0].id);
  const [form, setForm] = useState({ name: '', username: '', locality: '', mystery: false, flex: '' });
  const [photo, setPhoto] = useState<string | null>(null);
  const c = cities.find((x) => x.id === city)!;
  const e = res?.errors ?? {};
  return (
    <form onSubmit={(ev) => { ev.preventDefault(); const fd = new FormData(ev.currentTarget); startTransition(() => action(fd)); }} className="join-form" noValidate>
      <ol className="join-steps">
        <li><h3>Phone number</h3>
          <Field label="Mobile number" hint="One-time code sign-in opens with the first season. This field is switched off."><input type="tel" disabled placeholder="+91 ·····  ·····" /></Field></li>
        <li><h3>Confirm you are 18 or over</h3>
          <Field label="Date of birth" hint="Never shown publicly."><input name="dateOfBirth" type="date" required aria-invalid={!!e.dateOfBirth} /></Field><Err e={e.dateOfBirth} /></li>
        <li><h3>Your name on the board</h3>
          <Field label="Display name"><input name="displayName" maxLength={40} value={form.name} onChange={(ev) => setForm({ ...form, name: ev.target.value })} aria-invalid={!!e.displayName} /></Field><Err e={e.displayName} />
          <Field label="Username" hint="3–24 characters: lowercase letters, numbers, dots, underscores."><input name="username" maxLength={24} autoCapitalize="none" value={form.username} onChange={(ev) => setForm({ ...form, username: ev.target.value.toLowerCase() })} aria-invalid={!!e.username} /></Field><Err e={e.username} /></li>
        <li><h3>Your territory</h3>
          <Field label="City"><select name="cityId" value={city} onChange={(ev) => { setCity(ev.target.value); setForm({ ...form, locality: '' }); }}>{cities.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field><Err e={e.cityId} />
          <Field label="Locality" hint="City and locality lock for 90 days after you join."><select name="locality" value={form.locality} onChange={(ev) => setForm({ ...form, locality: ev.target.value })} aria-invalid={!!e.locality}><option value="">Choose a locality</option>{c.localities.map((l) => <option key={l}>{l}</option>)}</select></Field><Err e={e.locality} /></li>
        <li><h3>Photo</h3>
          <Field label="Profile photo" hint="Preview only. Nothing is uploaded."><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(ev) => { const f = ev.target.files?.[0]; if (!f || f.size > 5_000_000) { setPhoto(null); return; } const r = new FileReader(); r.onload = () => setPhoto(String(r.result)); r.readAsDataURL(f); }} /></Field>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photo && <img src={photo} alt="Your photo preview" className="photo-preview" />}</li>
        <li><h3>Flex line and title</h3>
          <Field label={`Flex line (${form.flex.length}/40)`} hint="Shown on your profile and board rows. No phone numbers, links or abuse."><input name="flexLine" maxLength={40} value={form.flex} onChange={(ev) => setForm({ ...form, flex: ev.target.value })} aria-invalid={!!e.flexLine} /></Field><Err e={e.flexLine} />
          <Field label="Title"><select name="title" defaultValue=""><option value="">No title</option>{TITLES.map((t) => <option key={t}>{t}</option>)}</select></Field></li>
        <li><h3>Mystery mode</h3>
          <label className="toggle"><input type="checkbox" name="mystery" checked={form.mystery} onChange={(ev) => setForm({ ...form, mystery: ev.target.checked })} /> <span>Rank anonymously. Your name, photo, socials and member number stay hidden until you choose to unmask. Nobody is ever unmasked automatically.</span></label>
          <MysteryPreview on={form.mystery} name={form.name} username={form.username} locality={form.locality} /></li>
      </ol>
      <button className="btn" type="submit" disabled={pending} data-testid="join-submit">{pending ? 'Checking…' : 'Check my profile'}</button>
      {res && <p className={res.ok ? 'notice' : 'notice warn'} role="status" data-testid="join-result">{res.message}</p>}
      {res?.ok && res.preview && (
        <div className="history" data-testid="join-preview"><h3>How your profile would look</h3>
          <div className="history-row"><b>{res.preview.mystery ? 'ANON' : '@'}</b><span>{res.preview.mystery ? 'Mystery mode: ANON number assigned when you join' : `${res.preview.displayName} · @${res.preview.username}`}</span><small>{res.preview.locality}, {res.preview.cityName}</small></div>
          {res.preview.flexLine && <div className="history-row"><b>“”</b><span>{res.preview.flexLine}</span><small>Flex line</small></div>}
        </div>
      )}
    </form>
  );
}

export function EditProfileForm({ initial, place, demo }: {
  initial: { displayName: string; username: string; title: string; flexLine: string; mystery: boolean; locality: string };
  place: { label: string; lockedUntil: string; locked: boolean }; demo: boolean;
}) {
  const [res, action, pending] = useActionState<FormResult | null, FormData>(saveProfile, null);
  const [f, setF] = useState({ ...initial, instagram: '', snapchat: '', vis: 'nobody' });
  const e = res?.errors ?? {};
  return (
    <form onSubmit={(ev) => { ev.preventDefault(); const fd = new FormData(ev.currentTarget); startTransition(() => action(fd)); }} className="join-form" noValidate>
      <div className="history" style={{ marginTop: 0 }}><h3>Public profile</h3>
        <Field label="Display name"><input name="displayName" maxLength={40} value={f.displayName} onChange={(ev) => setF({ ...f, displayName: ev.target.value })} aria-invalid={!!e.displayName} /></Field><Err e={e.displayName} />
        <Field label="Title"><select name="title" value={f.title} onChange={(ev) => setF({ ...f, title: ev.target.value })}><option value="">No title</option>{TITLES.map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label={`Flex line (${f.flexLine.length}/40)`} hint="Editable once a day. No phone numbers, links or abuse."><input name="flexLine" maxLength={40} value={f.flexLine} onChange={(ev) => setF({ ...f, flexLine: ev.target.value })} aria-invalid={!!e.flexLine} /></Field><Err e={e.flexLine} />
        <Field label="Territory" hint={place.locked ? `Locked until ${place.lockedUntil}. Genuine moves are handled by support.` : `The 90-day lock ended on ${place.lockedUntil}. Changing territory arrives with sign-in.`}><input value={place.label} disabled /></Field>
      </div>
      <div className="history"><h3>Socials</h3>
        <Field label="Instagram handle"><input name="instagram" value={f.instagram} onChange={(ev) => setF({ ...f, instagram: ev.target.value })} placeholder="handle" aria-invalid={!!e.instagram} /></Field><Err e={e.instagram} />
        <Field label="Snapchat handle"><input name="snapchat" value={f.snapchat} onChange={(ev) => setF({ ...f, snapchat: ev.target.value })} placeholder="handle" aria-invalid={!!e.snapchat} /></Field><Err e={e.snapchat} />
        <Field label="Show socials to" hint="Hidden by default. Handles show as unverified until verification is available."><select name="socialVisibility" value={f.vis} onChange={(ev) => setF({ ...f, vis: ev.target.value })}><option value="everyone">Everyone</option><option value="followers">Followers only</option><option value="nobody">Nobody</option></select></Field>
      </div>
      <div className="history"><h3>Mystery mode</h3>
        <label className="toggle"><input type="checkbox" name="mystery" checked={f.mystery} onChange={(ev) => setF({ ...f, mystery: ev.target.checked })} data-testid="mystery-toggle" /> <span>Hide my name, photo, socials and member number behind an ANON label. Only you can unmask.</span></label>
        <MysteryPreview on={f.mystery} name={f.displayName} username={f.username} locality={f.locality} />
      </div>
      <button className="btn" type="submit" disabled={pending} data-testid="profile-save">{pending ? 'Checking…' : 'Save changes'}</button>
      {res && <p className={res.ok ? 'notice' : 'notice warn'} role="status" data-testid="profile-result">{res.message}</p>}
      {demo && !res && <p className="share-status">Demo profile: changes are checked on the server but not saved.</p>}
    </form>
  );
}

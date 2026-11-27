// Profile (owner request): name (editable), phone, gender (fixed), friend code (riders), same-gender default, car (drivers), log out.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { View } from '@nextstop/shared';
import { api } from '../net/api.js';
import { useSession } from '../state/session.js';
import { fmtPhone } from '../lib/phone.js';
import { useInstall } from '../lib/install.js';
import { FriendCodeCard } from '../components/FriendCode.js';
import { Icon } from '../components/Icon.js';
import { Button, ErrorNote, Sheet, Switch, useAction } from '../components/ui.js';

export function Profile() {
  const view = useSession((s) => s.view) as View | null;
  const nav = useNavigate();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [last, setLast] = useState('');
  const [leaving, setLeaving] = useState(false);
  const a = useAction();
  const inst = useInstall();
  if (!view) return null;
  const me = view.me;
  const fullName = [me.firstName, me.lastName].filter(Boolean).join(' ');
  const back = view.role === 'driver' ? '/driver' : '/';
  const rider = view.role === 'rider' ? view : null;
  return (
    <main className="screen">
      <div className="row"><button type="button" className="iconbtn" aria-label="Back" onClick={() => nav(back)}><Icon name="back" /></button><h1 className="t-h2 grow">Profile</h1></div>

      <section className="card stack">
        <span className="t-caption text-2">Full name</span>
        {editing ? (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); if (name.trim() && last.trim()) void a.run(async () => { await api.updateProfile({ firstName: name, lastName: last }); setEditing(false); }); }}>
            <div className="row" style={{ gap: 8 }}>
              <input className="field grow" style={{ height: 44, minWidth: 0 }} value={name} maxLength={30} autoFocus autoComplete="given-name" onChange={(e) => setName(e.target.value)} aria-label="First name" placeholder="First name" />
              <input className="field grow" style={{ height: 44, minWidth: 0 }} value={last} maxLength={40} autoComplete="family-name" onChange={(e) => setLast(e.target.value)} aria-label="Last name" placeholder="Last name" />
            </div>
            <div className="row" style={{ gap: 8 }}>
              <Button type="submit" small disabled={!name.trim() || !last.trim() || a.busy}>Save</Button>
              <Button kind="secondary" small onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </form>
        ) : (
          <div className="row"><span className="t-h1 grow">{fullName}</span>
            <button type="button" className="linkbtn" onClick={() => { setName(me.firstName); setLast(me.lastName ?? ''); setEditing(true); }}>Edit</button></div>
        )}
        <ErrorNote text={a.message} />
        <div className="card-row"><span className="t-caption text-2 grow">Mobile</span><span className="t-body-l">{me.phone ? fmtPhone(me.phone) : 'Not added'}</span></div>
        {rider && <div className="card-row"><span className="t-caption text-2 grow">Gender</span><span className="t-body-l">{rider.me.gender === 'F' ? 'Woman' : 'Man'}</span></div>}
        {view.role === 'driver' && <div className="card-row"><span className="t-caption text-2 grow">Car</span><span className="t-body-l">{view.me.car} · {view.me.plate}</span></div>}
        <p className="t-caption text-2">{view.role === 'driver' ? 'Riders see your first name. Riders on your accepted trip can call you on this number.' : 'Riders see only your first name. Only your driver sees your number, during your trip.'}</p>
      </section>

      {rider && <FriendCodeCard code={rider.me.friendCode} name={fullName} />}

      {rider && (
        <div className="row card card--tight">
          <span className="grow"><span className="t-body-l" style={{ display: 'block', fontWeight: 500 }}>Same gender only, by default</span>
            <span className="t-caption text-2">Your starting choice for new rides. You can change it per ride.</span></span>
          <Switch on={rider.me.sameGenderOnly} label="Same gender only by default" onChange={(v) => void a.run(() => api.updateProfile({ sameGenderOnly: v }))} />
        </div>
      )}

      {inst.state === 'prompt' && (
        <button type="button" className="card card--tight row" style={{ textAlign: 'left' }} onClick={() => void inst.install()}>
          <Icon name="share" /><span className="grow"><span className="t-body-l" style={{ display: 'block', fontWeight: 600 }}>Install the app</span>
            <span className="t-caption text-2">Adds RideSync to your home screen</span></span><Icon name="next" size={16} />
        </button>
      )}
      {inst.state === 'ios' && (
        <div className="card card--tight row"><Icon name="share" />
          <span className="grow"><span className="t-body-l" style={{ display: 'block', fontWeight: 600 }}>Install the app</span>
            <span className="t-caption text-2">In Safari, tap Share, then "Add to Home Screen"</span></span></div>
      )}
      <button type="button" className="card card--tight row" style={{ color: 'var(--danger)', textAlign: 'left' }} onClick={() => setLeaving(true)}>
        <Icon name="logout" /><span className="t-body-l" style={{ fontWeight: 600 }}>Log out</span>
      </button>
      {leaving && (
        <Sheet onClose={() => setLeaving(false)}>
          <h2 className="t-h2">Log out?</h2>
          <p className="t-body text-2">Your rides stay booked. Sign back in with {me.phone ? fmtPhone(me.phone) : 'your number'} and a new code.</p>
          <Button kind="danger" onClick={() => void api.logout().finally(() => nav('/signup'))}>Log out</Button>
          <Button kind="secondary" onClick={() => setLeaving(false)}>Cancel</Button>
        </Sheet>
      )}
    </main>
  );
}

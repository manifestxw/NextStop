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
  const [leaving, setLeaving] = useState(false);
  const a = useAction();
  const inst = useInstall();
  if (!view) return null;
  const me = view.me;
  const back = view.role === 'driver' ? '/driver' : '/';
  const rider = view.role === 'rider' ? view : null;
  return (
    <main className="screen">
      <div className="row"><button type="button" className="iconbtn" aria-label="Back" onClick={() => nav(back)}><Icon name="back" /></button><h1 className="t-h2 grow">Profile</h1></div>

      <section className="card stack">
        <span className="t-caption text-2">First name</span>
        {editing ? (
          <form className="row" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (name.trim()) void a.run(async () => { await api.updateProfile({ firstName: name }); setEditing(false); }); }}>
            <input className="field grow" style={{ height: 44 }} value={name} maxLength={30} autoFocus onChange={(e) => setName(e.target.value)} aria-label="First name" />
            <Button type="submit" small disabled={!name.trim() || a.busy}>Save</Button>
          </form>
        ) : (
          <div className="row"><span className="t-h1 grow">{me.firstName}</span>
            <button type="button" className="linkbtn" onClick={() => { setName(me.firstName); setEditing(true); }}>Edit</button></div>
        )}
        <ErrorNote text={a.message} />
        <div className="card-row"><span className="t-caption text-2 grow">Mobile</span><span className="t-body-l">{me.phone ? fmtPhone(me.phone) : 'Not added'}</span></div>
        {rider && <div className="card-row"><span className="t-caption text-2 grow">Gender</span><span className="t-body-l">{rider.me.gender === 'F' ? 'Woman' : 'Man'}</span></div>}
        {view.role === 'driver' && <div className="card-row"><span className="t-caption text-2 grow">Car</span><span className="t-body-l">{view.me.car} · {view.me.plate}</span></div>}
        <p className="t-caption text-2">{view.role === 'driver' ? 'Riders on your accepted trip can call you on this number.' : 'Only your driver sees your number, during your trip.'}</p>
      </section>

      {rider && <FriendCodeCard code={rider.me.friendCode} />}

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

// Host setup "Start your own sync" (DESIGN §7): ready-by, price ladder, sync zone, gender switch.
import { Icon } from '../components/Icon.js';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import type { RiderView } from '@nextstop/shared';
import { api } from '../net/api.js';
import { useSession } from '../state/session.js';
import { useDraft } from '../state/draft.js';
import { fmtJod, fmtTime } from '../lib/format.js';
import { useNow } from '../lib/useNow.js';
import { Button, CategoryBadge, ErrorNote, Switch, useAction } from '../components/ui.js';
import { useQuote } from './Home.js';
import { tripBody } from './SharedList.js';

export function SharedSetup() {
  const view = useSession((s) => s.view) as RiderView | null;
  const d = useDraft();
  const now = useNow();
  const nav = useNavigate();
  const { quote, error } = useQuote();
  const a = useAction();
  if (!d.pickupKey || !d.destKey) return <Navigate to="/" replace />;
  const q = quote?.categories.find((c) => c.category === d.category);
  const sameGender = d.sameGenderOnly ?? view?.me.sameGenderOnly ?? true;
  const [friends, setFriends] = useState<{ code: string; name: string }[]>([]);
  const confirm = () => a.run(async () => {
    const v = await api.createRide(tripBody(d, now, sameGender)) as RiderView;
    if (!v.ride) return;
    // Invites go out once the ride exists; a refused one shows as an error on the ride screen's invite list.
    for (const f of friends) await api.invite(v.ride.id, f.code).catch(() => undefined);
    nav(`/ride/${v.ride.id}`);
  });
  return (
    <main className="screen">
      <div className="row"><button type="button" className="iconbtn" aria-label="Back" onClick={() => nav('/shared')}><Icon name="back" /></button></div>
      <div className="row" style={{ gap: 8 }}><h1 className="t-h2">Start your own sync</h1><CategoryBadge category={d.category} /></div>
      <label className="row card card--tight"><span className="grow t-body-l">Arrive by</span>
        <input type="time" step={300} value={d.time} onChange={(e) => e.target.value && d.set({ time: e.target.value })} className="field" style={{ width: 156, height: 44 }} />
      </label>
      {q && (
        <section className="card stack">
          <span className="t-eyebrow text-2">Be ready by</span>
          <span className="t-big">{fmtTime(q.beReadyBy)}</span>
          <div className="stack" style={{ marginTop: 'var(--s-2)' }}>
            {q.estimates.map((e) => (
              <div key={e.riders} className="row row--between t-body">
                <span>{e.riders === 1 ? 'Just you · If nobody joins' : `${e.riders} riders`}</span>
                <span style={{ fontWeight: 600 }}>{fmtJod(e.eachJod)}{e.riders > 1 ? ' each' : ''}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      {q && (
        <div className="card card--tight row">
          <svg width="64" height="28" viewBox="0 0 64 28" aria-hidden><rect x="1" y="4" width="62" height="20" rx="10" fill="var(--accent-soft)" stroke="var(--accent)" />
            <path d="M6 14 H58" stroke="var(--text-1)" strokeWidth="2" /></svg>
          <span><span className="t-body" style={{ fontWeight: 600, display: 'block' }}>Sync zone · {q.zoneKm.pickup} km</span>
            <span className="t-caption text-2">Riders within {q.zoneKm.pickup} km of your route can join</span></span>
        </div>
      )}
      <div className="row">
        <span className="grow t-body-l" style={{ fontWeight: 500 }}>Same gender only</span>
        <Switch on={sameGender} label="Same gender only" onChange={(v) => d.set({ sameGenderOnly: v })} />
      </div>
      <InviteFriends friends={friends} setFriends={setFriends} max={(q?.estimates.length ?? 4) - 1} />
      <ErrorNote text={a.message ?? error} />
      <div className="dock"><Button disabled={!q?.available || a.busy} onClick={confirm}>Confirm{q ? ` · ${fmtJod(q.soloJod)}` : ''}</Button></div>
    </main>
  );
}

/** Invite friends while setting up (P1): codes are checked now, invites are sent when the ride is created. */
function InviteFriends({ friends, setFriends, max }: { friends: { code: string; name: string }[]; setFriends: (f: { code: string; name: string }[]) => void; max: number }) {
  const [code, setCode] = useState('');
  const a = useAction();
  const add = () => a.run(async () => {
    if (friends.some((f) => f.code === code)) { setCode(''); return; }
    const f = await api.lookupCode(code);
    setFriends([...friends, { code, name: f.firstName }]);
    setCode('');
  });
  return (
    <section className="card card--tight stack">
      <span className="row" style={{ gap: 8 }}><Icon name="ticket" /><span className="t-body-l grow" style={{ fontWeight: 600 }}>Invite friends</span><span className="t-caption text-2">optional</span></span>
      {friends.length > 0 && (
        <div className="chips">{friends.map((f) => (
          <button key={f.code} type="button" className="chip chip--on" aria-label={`Remove ${f.name}`} onClick={() => setFriends(friends.filter((x) => x.code !== f.code))}>
            {f.name} <Icon name="close" size={14} /></button>
        ))}</div>
      )}
      {friends.length < max && (
        <form className="row" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (code.length === 6) add(); }}>
          <input className="field grow" style={{ height: 44, letterSpacing: '0.15em', textTransform: 'uppercase' }} placeholder="Friend code" value={code} maxLength={6}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} aria-label="Friend code" autoCapitalize="characters" autoComplete="off" />
          <Button type="submit" kind="secondary" small disabled={code.length !== 6 || a.busy}>Add</Button>
        </form>
      )}
      <ErrorNote text={a.message} />
      <span className="t-caption text-2">They get the invite when you confirm, pick their own pickup and pay their own share.</span>
    </section>
  );
}

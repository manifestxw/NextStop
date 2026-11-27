// Home + trip screen (DESIGN §7): places, arrive-by, "Same gender only", category tiles, Find rides.
// Prices on the tiles come from /api/quote; nothing is computed here.
import { MapView } from '../components/MapView.js';
import { Icon, type IconName } from '../components/Icon.js';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import type { Category, QuoteView, RiderView } from '@nextstop/shared';
import { api } from '../net/api.js';
import { useSession } from '../state/session.js';
import { PLACES, placeName, useDraft } from '../state/draft.js';
import { arriveByIso, fmtJod, fmtTime } from '../lib/format.js';
import { useNow } from '../lib/useNow.js';
import { Button, CategoryBadge, ErrorNote, Logo, Ring, Square, Switch, useAction } from '../components/ui.js';

export const CATS: { id: Category; name: string; icon: IconName }[] = [
  { id: 'economy', name: 'Economy', icon: 'car' }, { id: 'comfort', name: 'Comfort', icon: 'armchair' }, { id: 'airport', name: 'Airport', icon: 'plane' },
];

/** Quote for the current draft (refetches when the trip changes). */
export function useQuote(): { quote: QuoteView | null; error: string | null } {
  const d = useDraft();
  const now = useNow();
  const [quote, setQuote] = useState<QuoteView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const arriveBy = arriveByIso(now, d.time);
  useEffect(() => {
    if (!d.pickupKey || !d.destKey || d.pickupKey === d.destKey) { setQuote(null); return; }
    let live = true;
    api.quote({ pickup: { key: d.pickupKey }, dest: { key: d.destKey }, arriveBy })
      .then((q) => { if (live) { setQuote(q); setError(null); } })
      .catch((e: Error) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [d.pickupKey, d.destKey, arriveBy]);
  return { quote, error };
}

export function Home() {
  const view = useSession((s) => s.view) as RiderView | null;
  const d = useDraft();
  const nav = useNavigate();
  const { quote, error } = useQuote();
  const [editing, setEditing] = useState<'pickup' | 'dest' | null>(d.pickupKey ? null : 'pickup');
  if (!view) return null;
  if (view.role !== 'rider') return <Navigate to="/driver" replace />;
  if (view.ride && !d.dismissed.includes(view.ride.id)) return <Navigate to={`/ride/${view.ride.id}`} replace />;

  const sameGender = d.sameGenderOnly ?? view.me.sameGenderOnly;
  const genderWord = view.me.gender === 'F' ? 'women' : 'men';
  const q = (c: Category) => quote?.categories.find((x) => x.category === c);
  const chosen = q(d.category);
  const ready = !!(d.pickupKey && d.destKey && d.pickupKey !== d.destKey && chosen?.available);

  return (
    <main className="screen screen--flush" style={{ paddingTop: 0 }}>
      <MapView marks={quote ? [
        { kind: 'pickup', lat: quote.pickup.lat, lng: quote.pickup.lng, label: quote.pickup.name, me: true },
        { kind: 'dest', lat: quote.dest.lat, lng: quote.dest.lng, label: quote.dest.name },
      ] : []} />
      <div className="stack" style={{ padding: '0 var(--pad-x)', gap: 'var(--s-3)' }}>
        <div className="row row--between"><Logo /><span className="t-caption text-2">Code {view.me.friendCode}</span></div>
        {view.invites[0] && <InviteCard invite={view.invites[0]} sameGenderOnly={sameGender} />}
        {view.me.outstandingJod > 0 && (
          <p className="card card--tight row t-body-l" style={{ background: 'var(--raised)', border: 0 }}>
            <span style={{ color: 'var(--warn)' }}><Icon name="alert" /></span><span className="grow">Outstanding balance {fmtJod(view.me.outstandingJod)}</span>
          </p>
        )}

        <section className="card stack" aria-label="Your trip">
          {(['pickup', 'dest'] as const).map((which) => {
            const key = which === 'pickup' ? d.pickupKey : d.destKey;
            return (
              <div key={which} className="stack">
                <button type="button" className="row" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left' }} onClick={() => setEditing(which)}>
                  {which === 'pickup' ? <Ring /> : <Square />}
                  <span className="grow">
                    <span className="t-caption text-2" style={{ display: 'block' }}>{which === 'pickup' ? 'Pickup' : 'Where to?'}</span>
                    <span className="t-body-l truncate" style={{ display: 'block' }}>{key ? placeName(key) : 'Choose a place'}</span>
                  </span>
                </button>
                {editing === which && (
                  <div className="chips">
                    {PLACES.map((p) => (
                      <button key={p.key} type="button" className={`chip${key === p.key ? ' chip--on' : ''}`}
                        onClick={() => { d.set(which === 'pickup' ? { pickupKey: p.key } : { destKey: p.key }); setEditing(null); }}>
                        {which === 'pickup' ? <Ring /> : <Square />}{p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <label className="row"><Icon name="clock" /><span className="grow t-body-l">Arrive by</span>
            <input type="time" step={300} value={d.time} onChange={(e) => e.target.value && d.set({ time: e.target.value })}
              className="field" style={{ width: 156, height: 44 }} />
          </label>
        </section>

        <div className="row">
          <span className="grow"><span className="t-body-l" style={{ display: 'block', fontWeight: 500 }}>Same gender only</span>
            <span className="t-caption text-2">{sameGender ? `Only ${genderWord} can join` : 'Anyone going your way can join'}</span></span>
          <Switch on={sameGender} label="Same gender only" onChange={(v) => d.set({ sameGenderOnly: v })} />
        </div>

        <div className="tiles" role="group" aria-label="Category">
          {CATS.map((c) => {
            const cq = q(c.id);
            return (
              <button key={c.id} type="button" className="tile" data-cat={c.id} aria-pressed={d.category === c.id}
                disabled={!!quote && !cq?.available} onClick={() => d.set({ category: c.id })}>
                <Icon name={c.icon} size={24} />
                <span className="t-name">{c.name}</span>
                <span className="t-body" style={{ fontWeight: 600 }}>{cq?.available ? `from ${fmtJod(cq.fromJod)}` : c.id === 'airport' ? 'To the airport' : '—'}</span>
                <span className="t-caption" style={{ opacity: 0.8 }}>up to {c.id === 'economy' ? 4 : 3}</span>
              </button>
            );
          })}
        </div>
        <p className="t-caption text-2 center">Prices are estimates and may vary</p>
        <ErrorNote text={error} />
      </div>
      <div className="dock"><Button disabled={!ready} onClick={() => nav('/shared')}>Find rides</Button></div>
    </main>
  );
}

/** An invite from a friend (DESIGN §8 Invite card): pick your own pickup and join that ride directly. */
function InviteCard({ invite, sameGenderOnly }: { invite: RiderView['invites'][number]; sameGenderOnly: boolean }) {
  const nav = useNavigate();
  const [pickup, setPickup] = useState<string | null>(null);
  const a = useAction();
  const join = () => a.run(async () => {
    await api.join(invite.rideId, { pickup: { key: pickup! }, dest: { key: invite.destKey ?? 'JUST' }, arriveBy: invite.arriveBy,
      category: invite.category, sameGenderOnly, inviteId: invite.id });
    nav(`/ride/${invite.rideId}`);
  });
  return (
    <section className="pass" aria-label="Ride invite">
      <div className="pass-top" style={{ background: 'var(--accent-soft)', borderRadius: 'var(--r-lg) var(--r-lg) 0 0' }}>
        <div className="row row--between"><span className="t-eyebrow">Invited by {invite.fromFirstName}</span><CategoryBadge category={invite.category} /></div>
        <span className="t-body-l" style={{ color: 'var(--ink-900)' }}>To {invite.destArea} · arrive by {fmtTime(invite.arriveBy)}</span>
      </div>
      <div className="pass-perf" />
      <div className="pass-bottom">
        <span className="t-caption text-2">Your pickup</span>
        <div className="chips">
          {PLACES.filter((p) => p.key !== invite.destKey).map((p) => (
            <button key={p.key} type="button" className={`chip${pickup === p.key ? ' chip--on' : ''}`} onClick={() => setPickup(p.key)}><Ring />{p.name}</button>
          ))}
        </div>
        <ErrorNote text={a.message} />
        <Button disabled={!pickup || a.busy} onClick={join}>Join {invite.fromFirstName}'s ride</Button>
        <button type="button" className="linkbtn" style={{ alignSelf: 'center' }} onClick={() => a.run(() => api.declineInvite(invite.id))}>Decline</button>
      </div>
    </section>
  );
}

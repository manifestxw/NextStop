// Home + trip screen (DESIGN §7): places, arrive-by, "Same gender only", category tiles, Find rides.
// Prices on the tiles come from /api/quote; nothing is computed here.
import { MapView } from '../components/MapView.js';
import { Icon, type IconName } from '../components/Icon.js';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import type { Category, QuoteView, RiderView } from '@nextstop/shared';
import { api } from '../net/api.js';
import { useSession } from '../state/session.js';
import { PLACES, placeArea, placeName, placeRef, useDraft } from '../state/draft.js';
import { PlacePicker } from '../components/PlacePicker.js';
import { Sheet } from '../components/ui.js';
import { arriveByIso, fmtJod, fmtTime } from '../lib/format.js';
import { useNow } from '../lib/useNow.js';
import { Button, CategoryBadge, ErrorNote, GenderBadge, Logo, Ring, Square, Switch, useAction } from '../components/ui.js';

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
    api.quote({ pickup: placeRef(d.pickupKey), dest: placeRef(d.destKey), arriveBy })
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
  const [editing, setEditing] = useState<'pickup' | 'dest' | null>(null);
  const [profile, setProfile] = useState(false);
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
        <div className="row row--between"><Logo />
          <button type="button" className="chip" onClick={() => setProfile(true)} aria-label="Your friend code"><Icon name="ticket" size={16} />{view.me.friendCode}</button></div>
        {view.invites.map((inv) => <InviteCard key={inv.id} invite={inv} sameGenderOnly={sameGender} gender={view.me.gender} />)}
        <button type="button" className="card card--tight row" style={{ background: 'var(--accent-soft)', border: 0, textAlign: 'left', color: 'var(--ink-900)' }} onClick={() => nav('/plan')}>
          <Icon name="cap" /><span className="grow t-body-l" style={{ fontWeight: 600 }}>{view.plan ? `${view.plan.kind === 'weekly' ? 'Weekly' : 'Semester'} plan · my rides` : 'Uni plan · 20% off every campus ride'}</span><Icon name="next" size={16} />
        </button>
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
                <button type="button" className="row" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', minHeight: 48 }} onClick={() => setEditing(which)}>
                  {which === 'pickup' ? <Ring /> : <Square />}
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="t-caption text-2" style={{ display: 'block' }}>{which === 'pickup' ? 'Pickup' : 'Where to?'}</span>
                    <span className={`t-body-l truncate${key ? '' : ' text-2'}`} style={{ display: 'block' }}>{key ? placeName(key) : which === 'pickup' ? 'Search or pin your pickup' : 'Search a destination'}</span>
                  </span>
                  <span className="text-2"><Icon name="search" size={18} /></span>
                </button>
                {which === 'pickup' && !key && (
                  <div className="chips">
                    {PLACES.filter((p) => p.key !== d.destKey && p.key !== 'QAIA').map((p) => (
                      <button key={p.key} type="button" className="chip" onClick={() => d.set({ pickupKey: p.key })}><Ring />{p.name}</button>
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
      {editing && (
        <PlacePicker title={editing === 'pickup' ? 'Pickup' : 'Where to?'} kind={editing === 'pickup' ? 'pickup' : 'dest'}
          exclude={[editing === 'pickup' ? d.destKey : d.pickupKey].filter((k): k is string => !!k).concat(editing === 'pickup' ? ['QAIA'] : [])}
          near={quote ? (editing === 'pickup' ? quote.pickup : quote.dest) : undefined}
          onClose={() => setEditing(null)} onPick={(k) => { d.set(editing === 'pickup' ? { pickupKey: k } : { destKey: k }); setEditing(null); }} />
      )}
      {profile && <ProfileSheet view={view} onClose={() => setProfile(false)} />}
    </main>
  );
}

/** Your friend code (P1): friends type it to invite you; you type theirs to invite them. */
function ProfileSheet({ view, onClose }: { view: RiderView; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const code = view.me.friendCode;
  const text = `Ride with me on RideSync. My friend code: ${code}`;
  const copy = async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* not allowed */ } };
  const canShare = typeof navigator.share === 'function';
  return (
    <Sheet onClose={onClose}>
      <span className="t-eyebrow text-2">{view.me.firstName} · your friend code</span>
      <span className="code-big" aria-label={`Friend code ${code.split('').join(' ')}`}>{code}</span>
      <div className="row" style={{ gap: 8 }}>
        <Button kind="secondary" onClick={copy}><Icon name={copied ? 'check' : 'copy'} size={18} /> {copied ? 'Copied' : 'Copy code'}</Button>
        {canShare && <Button kind="secondary" onClick={() => navigator.share({ text }).catch(() => undefined)}><Icon name="share" size={18} /> Share</Button>}
      </div>
      <ul className="t-body text-2" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
        <li>A friend in a ride types your code to invite you. You'll see the invite here with your price before you join.</li>
        <li>To invite a friend, open your ride and tap "Invite with a friend code".</li>
        <li>Everyone picks their own pickup and pays their own share.</li>
      </ul>
    </Sheet>
  );
}

/** An invite from a friend (DESIGN §8 Invite card): who's in, your own pickup, your price, then join. */
function InviteCard({ invite, sameGenderOnly, gender }: { invite: RiderView['invites'][number]; sameGenderOnly: boolean; gender: RiderView['me']['gender'] }) {
  const nav = useNavigate();
  const [pickup, setPickup] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [preview, setPreview] = useState<{ eachJod: number; myPaysJod: number; myPickupAt: string; riders: number } | null>(null);
  const [why, setWhy] = useState<string | null>(null);
  const a = useAction();
  useEffect(() => {
    if (!pickup) return;
    let live = true;
    setPreview(null); setWhy(null);
    api.previewInvite(invite.id, { pickup: placeRef(pickup), sameGenderOnly })
      .then((p) => { if (live) setPreview(p); }).catch((e: Error) => { if (live) setWhy(e.message); });
    return () => { live = false; };
  }, [pickup, invite.id, sameGenderOnly]);
  const join = () => a.run(async () => {
    await api.acceptInvite(invite.id, { pickup: placeRef(pickup!), sameGenderOnly });
    nav(`/ride/${invite.rideId}`);
  });
  const full = invite.seatsLeft <= 0;
  return (
    <section className="pass" aria-label={`Ride invite from ${invite.fromFirstName}`}>
      <div className="pass-top" style={{ background: 'var(--accent-soft)', borderRadius: 'var(--r-lg) var(--r-lg) 0 0' }}>
        <div className="row row--between"><span className="t-eyebrow">Invited by {invite.fromFirstName}</span><CategoryBadge category={invite.category} /></div>
        <span className="t-body-l" style={{ color: 'var(--ink-900)', fontWeight: 600 }}>To {invite.destArea} · arrive by {fmtTime(invite.arriveBy)}</span>
        <span className="t-caption" style={{ color: 'var(--ink-900)' }}>{invite.hostFirstName}'s ride from {invite.pickupArea} · {invite.riders} rider{invite.riders === 1 ? '' : 's'} in · {full ? 'full' : `${invite.seatsLeft} seat${invite.seatsLeft === 1 ? '' : 's'} left`}</span>
      </div>
      <div className="pass-perf" />
      <div className="pass-bottom">
        <div className="row row--between"><span className="t-caption text-2">Your pickup</span><GenderBadge mode={invite.genderMode} gender={gender} /></div>
        <button type="button" className="row card card--tight" style={{ textAlign: 'left', width: '100%' }} onClick={() => setPicking(true)}>
          <Ring /><span className="grow t-body-l truncate">{pickup ? placeName(pickup) : 'Search or pin your pickup'}</span><Icon name="search" size={18} />
        </button>
        {!pickup && (
          <div className="chips">
            {PLACES.filter((p) => p.key !== invite.destKey && p.key !== 'QAIA').map((p) => (
              <button key={p.key} type="button" className="chip" onClick={() => setPickup(p.key)}><Ring />{p.name}</button>
            ))}
          </div>
        )}
        {pickup && !preview && !why && <p className="t-caption text-2">Checking your price…</p>}
        {preview && (
          <div className="row row--between">
            <span className="stack" style={{ gap: 0 }}><span className="t-caption text-2">You'd pay · {preview.riders} riders</span>
              <span className="row" style={{ gap: 6, alignItems: 'baseline' }}><span className="t-eyebrow">JOD</span><span className="t-big">{preview.myPaysJod.toFixed(2)}</span></span></span>
            <span className="stack" style={{ gap: 0, textAlign: 'right' }}><span className="t-caption text-2">Be ready by</span><span className="t-body-l" style={{ fontWeight: 600 }}>{fmtTime(preview.myPickupAt)}</span></span>
          </div>
        )}
        {why && <p className="t-body" style={{ color: 'var(--danger)' }}>{why}{placeArea(pickup) ? ` (from ${placeArea(pickup)})` : ''}. Try a pickup closer to {invite.pickupArea}.</p>}
        <ErrorNote text={a.message} />
        <Button disabled={!preview || full || a.busy} onClick={join}>{preview ? `Join · ${fmtJod(preview.myPaysJod)}` : `Join ${invite.fromFirstName}'s ride`}</Button>
        <button type="button" className="linkbtn" style={{ alignSelf: 'center' }} onClick={() => a.run(() => api.declineInvite(invite.id))}>Decline</button>
      </div>
      {picking && <PlacePicker title="Your pickup" kind="pickup" exclude={['QAIA', ...(invite.destKey ? [invite.destKey] : [])]}
        onClose={() => setPicking(false)} onPick={(k) => { setPickup(k); setPicking(false); }} />}
    </section>
  );
}

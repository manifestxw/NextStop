// Home + trip screen (DESIGN §7): places, arrive-by, "Same gender only", category tiles, Find rides.
// Prices on the tiles come from /api/quote; nothing is computed here.
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import type { Category, QuoteView, RiderView } from '@nextstop/shared';
import { api } from '../net/api.js';
import { useSession } from '../state/session.js';
import { PLACES, placeName, useDraft } from '../state/draft.js';
import { arriveByIso, fmtJod } from '../lib/format.js';
import { useNow } from '../lib/useNow.js';
import { Button, ErrorNote, Logo, MapPanel, Ring, Square, Switch } from '../components/ui.js';

export const CATS: { id: Category; name: string; icon: string }[] = [
  { id: 'economy', name: 'Economy', icon: '🚗' }, { id: 'comfort', name: 'Comfort', icon: '🛋️' }, { id: 'airport', name: 'Airport', icon: '✈️' },
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
      <MapPanel pickup={d.pickupKey ? placeName(d.pickupKey) : undefined} dest={d.destKey ? placeName(d.destKey) : undefined} pulse />
      <div className="stack" style={{ padding: '0 var(--pad-x)', gap: 'var(--s-3)' }}>
        <div className="row row--between"><Logo /><span className="t-caption text-2">Code {view.me.friendCode}</span></div>
        {view.me.outstandingJod > 0 && <p className="card card--tight t-body">⚠️ Outstanding balance {fmtJod(view.me.outstandingJod)}</p>}

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
          <label className="row"><span aria-hidden>🕗</span><span className="grow t-body-l">Arrive by</span>
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
                <span aria-hidden>{c.icon}</span>
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

// Uni plans (DESIGN §8, SPEC §3.19): pick a plan, build the week, pay with the demo card, then manage
// planned rides. Prices, limits and placement are decided by the server; this screen only collects choices.
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import type { RiderView } from '@nextstop/shared';
import { api } from '../net/api.js';
import { useSession } from '../state/session.js';
import { PLACES, placeName, placeRef } from '../state/draft.js';
import { PlacePicker } from '../components/PlacePicker.js';
import { ammanDate, fmtTime } from '../lib/format.js';
import { useNow } from '../lib/useNow.js';
import { Icon } from '../components/Icon.js';
import { Button, ErrorNote, Ring, Sheet, Square, useAction } from '../components/ui.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CAMPUSES = PLACES.filter((p) => p.key === 'JUST' || p.key === 'YU');
const STATE_LABEL = { PLANNED: 'Planned', PLACED: 'Synced', CANCELED: 'Canceled', UNPLACEABLE: "Couldn't plan" } as const;

export function Plan() {
  const view = useSession((s) => s.view) as RiderView | null;
  if (!view) return null;
  if (view.role !== 'rider') return <Navigate to="/" replace />;
  return view.plan ? <MyPlan plan={view.plan} /> : <Builder sameGenderOnly={view.me.sameGenderOnly} />;
}

function Header({ title }: { title: string }) {
  const nav = useNavigate();
  return (
    <div className="row"><button type="button" className="iconbtn" aria-label="Back" onClick={() => nav('/')}><Icon name="back" /></button>
      <h1 className="t-h2 grow">{title}</h1></div>
  );
}

function Builder({ sameGenderOnly }: { sameGenderOnly: boolean }) {
  const now = useNow();
  const [kind, setKind] = useState<'weekly' | 'semester'>('semester');
  const [home, setHome] = useState('CC');
  const [campus, setCampus] = useState('JUST');
  const [time, setTime] = useState('08:00');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4]);
  const [paying, setPaying] = useState(false);
  const [pickingHome, setPickingHome] = useState(false);
  const [lo, hi] = kind === 'weekly' ? [3, 5] : [2, 5];
  const ok = days.length >= lo && days.length <= hi;
  // Weekly = the next date of each chosen weekday that is at least 12 h away (display + request; the server re-checks).
  const nextDate = (weekday: number) => {
    for (let k = 0; k < 8; k++) {
      const d = ammanDate(now + k * 86_400_000);
      const iso = `${d}T${time}:00+03:00`;
      if (new Date(`${d}T12:00:00+03:00`).getUTCDay() === weekday && Date.parse(iso) >= now + 12 * 3_600_000) return iso;
    }
    return null;
  };
  const trip = (arriveBy: string) => ({ pickup: placeRef(home), dest: { key: campus }, arriveBy, category: 'economy' as const, sameGenderOnly });
  const toggle = (d: number) => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort());
  return (
    <main className="screen">
      <Header title="Ride to campus for less" />
      <div className="tiles" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {(['weekly', 'semester'] as const).map((k) => (
          <button key={k} type="button" className="tile" data-cat="economy" aria-pressed={kind === k} onClick={() => setKind(k)} style={{ minHeight: 120 }}>
            <span className="t-eyebrow">{k}</span>
            <span className="t-name">{k === 'weekly' ? '2.00 JD / week' : '1.60 JD / week'}</span>
            <span className="t-caption">{k === 'weekly' ? '3–5 rides this week · 1 replacement' : '2–5 rides every week · replacements: 5%'}</span>
          </button>
        ))}
      </div>
      <p className="t-caption text-2">20% off your share on rides to or from campus. Others in the car don't need a plan.</p>
      <section className="card stack">
        <span className="t-caption text-2">From</span>
        <button type="button" className="row card card--tight" style={{ textAlign: 'left', width: '100%' }} onClick={() => setPickingHome(true)}>
          <Ring /><span className="grow t-body-l truncate">{placeName(home)}</span><Icon name="search" size={18} /></button>
        {pickingHome && <PlacePicker title="Home pickup" kind="pickup" exclude={['JUST', 'YU', 'QAIA']} onClose={() => setPickingHome(false)}
          onPick={(k) => { setHome(k); setPickingHome(false); }} />}
        <span className="t-caption text-2">To campus</span>
        <div className="chips">{CAMPUSES.map((p) => <button key={p.key} type="button" className={`chip${campus === p.key ? ' chip--on' : ''}`} onClick={() => setCampus(p.key)}><Square />{p.name}</button>)}</div>
        <label className="row"><Icon name="clock" /><span className="grow t-body-l">Arrive by</span>
          <input type="time" step={300} value={time} onChange={(e) => e.target.value && setTime(e.target.value)} className="field" style={{ width: 156, height: 44 }} /></label>
      </section>
      <section className="card stack">
        <div className="row row--between"><span className="t-body-l" style={{ fontWeight: 600 }}>{days.length} rides / week</span>
          <span className="t-caption" style={{ color: ok ? 'var(--text-2)' : 'var(--danger)' }}>Pick {lo}–{hi}</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
          {DAYS.map((d, i) => (
            <button key={d} type="button" aria-pressed={days.includes(i)} onClick={() => toggle(i)} className="chip"
              style={{ justifyContent: 'center', padding: 0, height: 52, flexDirection: 'column', gap: 0, ...(days.includes(i) ? { background: 'var(--accent)', color: 'var(--ink-900)' } : {}) }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{d}</span>{days.includes(i) && <span style={{ fontSize: 11 }}>{time}</span>}
            </button>
          ))}
        </div>
        {kind === 'semester' && <span className="t-caption text-2">Repeats every week until 31 Jan. Each ride is synced 12 hours before.</span>}
      </section>
      <div className="dock"><Button disabled={!ok} onClick={() => setPaying(true)}>Pay with card</Button></div>
      {paying && <CardSheet onClose={() => setPaying(false)} onPay={(card) => api.subscribe(kind === 'weekly'
        ? { kind, trips: days.map(nextDate).filter((x): x is string => !!x).map(trip), card }
        : { kind, pattern: days.map((weekday) => ({ weekday, arriveByTime: time, pickup: { key: home }, dest: { key: campus }, category: 'economy' as const, sameGenderOnly })), card })} />}
    </main>
  );
}

function CardSheet({ onClose, onPay }: { onClose: () => void; onPay: (card: { number: string; expiry: string; cvc: string }) => Promise<unknown> }) {
  const [number, setNumber] = useState(''), [expiry, setExpiry] = useState(''), [cvc, setCvc] = useState('');
  const a = useAction();
  return (
    <Sheet onClose={onClose}>
      <div className="row"><h2 className="t-h2 grow">Pay with card</h2><span className="badge badge--raised" style={{ color: 'var(--warn)' }}>Demo</span></div>
      <input className="field" inputMode="numeric" placeholder="Card number" value={number} onChange={(e) => setNumber(e.target.value)} aria-label="Card number" />
      <div className="row">
        <input className="field" placeholder="MM/YY" value={expiry} onChange={(e) => setExpiry(e.target.value)} aria-label="Expiry" />
        <input className="field" inputMode="numeric" placeholder="CVC" value={cvc} onChange={(e) => setCvc(e.target.value)} aria-label="CVC" />
      </div>
      <p className="t-caption text-2">Demo only. Use 4242 4242 4242 4242. Nothing is charged.</p>
      <button type="button" className="linkbtn" style={{ alignSelf: 'flex-start' }} onClick={() => { setNumber('4242 4242 4242 4242'); setExpiry('12/28'); setCvc('123'); }}>Fill test card</button>
      <ErrorNote text={a.message} />
      <Button disabled={!number || !expiry || !cvc || a.busy} onClick={() => a.run(async () => { await onPay({ number, expiry, cvc }); onClose(); })}><Icon name="card" />Pay</Button>
    </Sheet>
  );
}

function MyPlan({ plan }: { plan: NonNullable<RiderView['plan']> }) {
  const now = useNow();
  const nav = useNavigate();
  const a = useAction();
  const [replacing, setReplacing] = useState(false);
  const upcoming = plan.trips.filter((t) => Date.parse(t.arriveBy) > now - 3_600_000);
  return (
    <main className="screen">
      <Header title="My plan" />
      <section className="pass">
        <div className="pass-top">
          <span className="t-eyebrow">{plan.kind} plan</span>
          <span className="t-h1">Until {new Date(plan.end).toLocaleDateString('en-US', { timeZone: 'Asia/Amman', day: 'numeric', month: 'short' })}</span>
          <span className="t-body text-2">Card •••• {plan.card.last4} · 20% off campus rides</span>
        </div>
        <div className="pass-perf" />
        <div className="pass-bottom">
          <span className="t-body">{plan.replacementsLeft} replacement{plan.replacementsLeft === 1 ? '' : 's'} left{plan.replacementCredits > 0 ? ` · ${plan.replacementCredits} to plan` : ''}</span>
        </div>
      </section>
      <ErrorNote text={a.error?.code === 'USE_LEAVE' ? 'This ride is already synced. Open it and use Leave ride.' : a.message} />
      <section className="card card--tight">
        {upcoming.length === 0 && <p className="t-body text-2">No upcoming rides.</p>}
        {upcoming.slice(0, 12).map((t) => (
          <div key={t.id} className="card-row">
            <span className="grow">
              <span className="t-body" style={{ fontWeight: 600, display: 'block' }}>
                {new Date(t.arriveBy).toLocaleDateString('en-US', { timeZone: 'Asia/Amman', weekday: 'short', day: 'numeric', month: 'short' })} · {fmtTime(t.arriveBy)}
              </span>
              <span className="t-caption text-2">{t.pickupArea} → {t.destArea}</span>
            </span>
            <span className={`badge ${t.state === 'PLACED' ? 'badge--accent' : 'badge--raised'}`} style={t.state === 'UNPLACEABLE' ? { color: 'var(--danger)' } : undefined}>{STATE_LABEL[t.state]}</span>
            {t.state === 'PLACED' && t.rideId && <button type="button" className="linkbtn" onClick={() => nav(`/ride/${t.rideId}`)}>Open</button>}
            {t.state === 'PLANNED' && <button type="button" className="linkbtn" style={{ color: 'var(--danger)' }} disabled={a.busy} onClick={() => a.run(() => api.cancelPlanned(t.id))}>Cancel</button>}
          </div>
        ))}
      </section>
      {plan.replacementCredits > 0 && <div className="dock"><Button onClick={() => setReplacing(true)}>Plan a replacement</Button></div>}
      {replacing && <ReplacementSheet onClose={() => setReplacing(false)} />}
    </main>
  );
}

function ReplacementSheet({ onClose }: { onClose: () => void }) {
  const now = useNow();
  const view = useSession((s) => s.view) as RiderView;
  const first = view.plan!.trips[0]!;
  const [day, setDay] = useState(1), [time, setTime] = useState('08:00');
  const a = useAction();
  const dates = Array.from({ length: 7 }, (_, k) => ammanDate(now + (k + 1) * 86_400_000));
  const home = PLACES.find((p) => p.name.includes(first.pickupArea.replace(' area', '')))?.key ?? 'CC';
  return (
    <Sheet onClose={onClose}>
      <h2 className="t-h2">Plan a replacement</h2>
      <div className="chips">{dates.map((d, k) => (
        <button key={d} type="button" className={`chip${day === k + 1 ? ' chip--on' : ''}`} onClick={() => setDay(k + 1)}>
          {new Date(`${d}T12:00:00+03:00`).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}</button>
      ))}</div>
      <label className="row"><span className="grow t-body-l">Arrive by</span>
        <input type="time" step={300} value={time} onChange={(e) => e.target.value && setTime(e.target.value)} className="field" style={{ width: 156, height: 44 }} /></label>
      <ErrorNote text={a.message} />
      <Button disabled={a.busy} onClick={() => a.run(async () => {
        await api.planReplacement({ trip: { pickup: { key: home }, dest: { key: 'JUST' }, arriveBy: `${dates[day - 1]}T${time}:00+03:00`, category: 'economy', sameGenderOnly: view.me.sameGenderOnly } });
        onClose();
      })}>Plan it</Button>
    </Sheet>
  );
}

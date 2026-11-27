// Driver app (DESIGN §8, §12.2, Cockpit surfaces): idle home with offers, the offer sheet, the active trip + summary.
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import type { DriverStop, DriverView } from '@nextstop/shared';
import { api } from '../net/api.js';
import { Icon } from '../components/Icon.js';
import { useSession } from '../state/session.js';
import { useDraft } from '../state/draft.js';
import { fmtJod, fmtTime } from '../lib/format.js';
import { useNow } from '../lib/useNow.js';
import { Button, CategoryBadge, ErrorNote, GenderBadge, Logo, MergeMark, Ring, Sheet, Square, useAction } from '../components/ui.js';
import { MapView, type Mark } from '../components/MapView.js';

const useDriver = () => useSession((s) => s.view) as DriverView | null;

const spotCircles = (d: DriverView['demand']) => {
  const max = Math.max(1, ...(d?.spots ?? []).map((s) => s.perHour));
  return d?.spots.map((s, i) => ({ ...s.center, radiusKm: s.radiusKm, best: i === d.bestIndex, strength: s.perHour / max }));
};

/** Best spot card (DESIGN §8, SPEC §3.18): advice only, offers still follow dispatch. */
function BestSpot({ demand }: { demand: NonNullable<DriverView['demand']> }) {
  const best = demand.bestIndex !== null ? demand.spots[demand.bestIndex] : undefined;
  if (!best) return null;
  const max = Math.max(...demand.spots.map((s) => s.perHour));
  return (
    <section className="card stack">
      <span className="t-eyebrow text-2">Best spot near you</span>
      {demand.inside ? (
        <><h2 className="t-h1">You're in a busy area</h2><p className="t-body text-2">Stay close to {best.area.replace(' area', '')}.</p></>
      ) : (
        <>
          <h2 className="t-h1">{best.area}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[[`${best.km.toFixed(1)} km`, 'away'], [`~${Math.round(best.min)} min`, 'drive'], [`~${Math.round(best.perHour)}`, 'pickups / hr']].map(([v, l]) => (
              <span key={l} className="stack" style={{ gap: 0 }}><span className="t-big" style={{ fontSize: 24 }}>{v}</span><span className="t-caption text-2">{l}</span></span>
            ))}
          </div>
        </>
      )}
      <p className="t-caption text-2">Busy in the next hour · from 4 weeks of pickups</p>
      {demand.sample && <p className="t-caption" style={{ color: 'var(--warn)' }}>Sample data</p>}
      <div className="stack" style={{ gap: 6 }}>
        {demand.spots.map((s, i) => (
          <div key={i} className="row t-body" style={{ gap: 8 }}>
            <span className="grow truncate">{s.area}</span><span className="text-2">{s.km.toFixed(1)} km</span>
            <span style={{ width: 60, height: 6, borderRadius: 3, background: 'var(--raised)', overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${(s.perHour / max) * 100}%`, background: 'var(--accent)' }} /></span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Accepted trip only (offers carry no coordinates): pickups numbered in stop order, one square per destination. */
function stopMarks(stops: DriverStop[]): Mark[] {
  const marks: Mark[] = [];
  let n = 0;
  for (const s of stops) {
    if (!s.place || s.done) continue;
    if (s.kind === 'P') {
      n++;
      const same = marks.find((m) => m.kind === 'pickup' && m.lat === s.place!.lat && m.lng === s.place!.lng);
      if (same) { same.n = `${same.n}·${n}`; same.label += `, ${s.firstName}`; }   // two riders at one spot: one marker "1·2"
      else marks.push({ kind: 'pickup', ...s.place, label: `${s.firstName} · ${s.shortAddress}`, n: String(n) });
    }
    else if (!marks.some((m) => m.kind === 'dest' && m.lat === s.place!.lat && m.lng === s.place!.lng)) marks.push({ kind: 'dest', ...s.place, label: s.shortAddress });
  }
  return marks;
}

export function DriverHome() {
  const view = useDriver();
  const dismissed = useDraft((s) => s.dismissed);
  const nav = useNavigate();
  if (!view) return null;
  if (view.role !== 'driver') return <Navigate to="/" replace />;
  if (view.trip && !dismissed.includes(view.trip.rideId)) return <Navigate to={`/driver/trip/${view.trip.rideId}`} replace />;
  return (
    <main className="screen screen--flush" style={{ paddingTop: 0 }}>
      <MapView marks={[]} dark spots={spotCircles(view.demand)} />
      <div className="stack" style={{ padding: '0 var(--pad-x)', gap: 'var(--s-3)' }}>
        <div className="row row--between"><Logo /><span className="row" style={{ gap: 8 }}><span className="t-caption text-2">{view.me.car} · {view.me.plate}</span>
          <button type="button" className="iconbtn" aria-label="Profile" onClick={() => nav('/profile')}><Icon name="user" /></button></span></div>
        <p className="row t-h1" style={{ gap: 10 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--success)' }} />You're online</p>
        {view.offers.length === 0 && <p className="row t-body text-2"><MergeMark loading /> Waiting for scheduled offers</p>}
        {view.offers.length === 0 && view.demand && <BestSpot demand={view.demand} />}
        {view.offers.map((o) => (
          <button key={o.rideId} type="button" className="card stack" style={{ textAlign: 'left' }} onClick={() => nav(`/driver/offer/${o.rideId}`)}>
            <span className="row" style={{ gap: 8 }}><CategoryBadge category={o.category} fill /><GenderBadge mode={o.genderMode} /></span>
            <span className="t-big">{fmtJod(o.fareJod)}</span>
            <span className="t-body text-2">{o.riders} riders · first pickup {fmtTime(o.firstPickupAt)} · respond by {fmtTime(o.respondBy)}</span>
          </button>
        ))}
      </div>
    </main>
  );
}

function Timeline({ stops, actions }: { stops: DriverStop[]; actions?: boolean }) {
  return (
    <div className="timeline">
      {stops.map((s) => (
        <div key={s.id} className={`tl-row${s.done && actions ? ' tl-row--done' : ''}`}>
          {s.kind === 'P' ? <Ring /> : <Square />}
          <span className="grow" style={{ minWidth: 0 }}>
            <span className="t-body" style={{ fontWeight: 600 }}>{fmtTime(s.at)}</span>{' '}
            <span className="t-body">{s.firstName}{s.guestFirstName ? ' +1' : ''}</span>
            <span className="t-body text-2 truncate" style={{ display: 'block' }}>{s.shortAddress}</span>
          </span>
          <span className="t-body" style={{ fontWeight: 500 }}>{s.kind === 'P' && s.cashDueJod !== undefined ? fmtJod(s.cashDueJod) : s.done && actions ? <span style={{ color: 'var(--success-text)' }}><Icon name="check" label="done" /></span> : ''}</span>
        </div>
      ))}
    </div>
  );
}

export function DriverOffer() {
  const view = useDriver();
  const { id } = useParams();
  const nav = useNavigate();
  const a = useAction();
  if (!view || view.role !== 'driver') return <Navigate to="/" replace />;
  if (view.trip && view.trip.rideId === id && view.trip.state !== 'COMPLETED') return <Navigate to={`/driver/trip/${id}`} replace />;
  const o = view.offers.find((x) => x.rideId === id);
  if (!o) {
    return (
      <main className="screen" style={{ justifyContent: 'center' }}>
        <h1 className="t-h2">This ride is no longer available</h1>
        <div className="dock"><Button onClick={() => nav('/driver')}>Back</Button></div>
      </main>
    );
  }
  return (
    <main className="screen">
      <div className="row row--between">
        <span className="row" style={{ gap: 8 }}><CategoryBadge category={o.category} fill /><GenderBadge mode={o.genderMode} /></span>
        <span className="t-eyebrow text-2">First pickup {fmtTime(o.firstPickupAt)}</span>
      </div>
      <span className="t-hero">{fmtJod(o.fareJod)}</span>
      <p className="t-body text-2">{o.riders} riders · cash · collect {fmtJod(o.collectJod)}</p>
      <section className="card card--tight"><Timeline stops={o.stops} /></section>
      <p className="t-body text-2">{o.km} km · ~{Math.round(o.min)} min</p>
      <ErrorNote text={a.message} />
      <div className="dock">
        <div className="btn-pair">
          <Button kind="secondary" disabled={a.busy} onClick={() => a.run(async () => { await api.reject(o.rideId); nav('/driver'); })}>Reject</Button>
          <Button disabled={a.busy} onClick={() => a.run(async () => { await api.accept(o.rideId); nav(`/driver/trip/${o.rideId}`); })}>Accept</Button>
        </div>
        <p className="t-caption text-2 center">Respond by {fmtTime(o.respondBy)}</p>
      </div>
    </main>
  );
}

export function DriverTrip() {
  const view = useDriver();
  const { id } = useParams();
  const d = useDraft();
  const nav = useNavigate();
  const [canceling, setCanceling] = useState(false);
  if (!view || view.role !== 'driver') return <Navigate to="/" replace />;
  const t = view.trip;
  if (!t || t.rideId !== id) return <Navigate to="/driver" replace />;
  const s = t.summary;
  if (s) {
    return (
      <main className="screen">
        <div className="stack center" style={{ alignItems: 'center', marginTop: 'var(--s-6)' }}><MergeMark size={96} done /><h1 className="t-h1">Trip complete</h1></div>
        <section className="card stack">
          {s.riders.map((r, i) => <div key={i} className="row row--between t-body-l"><span>{r.firstName}</span><span>{fmtJod(r.cashJod)} cash</span></div>)}
          {s.creditJod > 0 && <div className="row row--between t-body-l"><span>Credit from RideSync</span><span>{fmtJod(s.creditJod)}</span></div>}
          {s.uniCreditJod > 0 && <div className="row row--between t-body-l"><span>Uni plan credit from RideSync</span><span>{fmtJod(s.uniCreditJod)}</span></div>}
          <div className="row row--between" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}><span className="t-body-l">Total</span><span className="t-big">{fmtJod(s.totalJod)}</span></div>
        </section>
        <div className="dock"><Button onClick={() => { d.dismiss(t.rideId); nav('/driver'); }}>Done</Button></div>
      </main>
    );
  }
  return (
    <main className="screen screen--flush" style={{ paddingTop: 0 }}>
      <MapView dark fit="pickups" marks={stopMarks(t.stops)} route={t.route} />
      <div className="stack" style={{ padding: '0 var(--pad-x)', gap: 'var(--s-3)' }}>
        <h1 className="t-h1">{t.category[0]!.toUpperCase() + t.category.slice(1)} · {t.riders} riders</h1>
        <p className="t-body text-2">Collect {fmtJod(t.collectJod)} cash{t.creditJod > 0 ? ` · ${fmtJod(t.creditJod)} credit at trip end` : ''}</p>
        <section className="card card--tight"><StopActions trip={t} /></section>
        {t.state === 'ACCEPTED' && <button type="button" className="linkbtn" style={{ color: 'var(--danger)', alignSelf: 'flex-start' }} onClick={() => setCanceling(true)}>Cancel trip</button>}
      </div>
      {canceling && <CancelSheet rideId={t.rideId} onClose={() => setCanceling(false)} />}
    </main>
  );
}

/** One row per stop with the driver's taps (P1): Picked up · No-show (5 min after the shown time) · Dropped off. */
function StopActions({ trip }: { trip: NonNullable<DriverView['trip']> }) {
  const a = useAction();
  const nav = useNavigate();
  const now = useNow();
  const picked = new Set(trip.stops.filter((s) => s.kind === 'P' && s.done).map((s) => s.firstName));
  const cashFor = (name: string) => trip.stops.find((s) => s.kind === 'P' && s.firstName === name)?.cashDueJod ?? 0;
  const tap = (stopId: string, action: 'picked-up' | 'dropped-off' | 'no-show') => a.run(() => api.stop(trip.rideId, stopId, action));
  return (
    <div className="stack">
      <div className="timeline">
        {trip.stops.map((s) => (
          <div key={s.id} className={`tl-row${s.done ? ' tl-row--done' : ''}`}>
            {s.kind === 'P' ? <Ring /> : <Square />}
            <span className="grow" style={{ minWidth: 0 }}>
              <span className="t-body" style={{ fontWeight: 600 }}>{fmtTime(s.at)}</span>{' '}
              <span className="t-body">{s.firstName}{s.guestFirstName ? ' +1' : ''}</span>
              <span className="t-body text-2 truncate" style={{ display: 'block' }}>{s.shortAddress}</span>
              {!!s.uniCreditJod && <span className="t-caption text-2" style={{ display: 'block' }}>+ {s.uniCreditJod.toFixed(2)} from RideSync (Uni plan)</span>}
              {!s.done && s.kind === 'P' && (
                <span className="row" style={{ gap: 8, marginTop: 6 }}>
                  <Button kind="secondary" small disabled={a.busy} onClick={() => tap(s.id, 'picked-up')} style={{ whiteSpace: 'nowrap' }}>Picked up</Button>
                  <button type="button" className="iconbtn" aria-label={`Message ${s.firstName}`} onClick={() => nav(`/driver/trip/${trip.rideId}/chat/${s.id.slice(2)}`)}><Icon name="message" /></button>
                  {s.phone && <a className="iconbtn" href={`tel:${s.phone}`} aria-label={`Call ${s.firstName}`}><Icon name="phone" /></a>}
                  {now >= Date.parse(s.at) - (Date.parse(s.at) % 60_000) + 5 * 60_000 && (
                    <Button kind="danger" small disabled={a.busy} onClick={() => tap(s.id, 'no-show')}>No-show</Button>
                  )}
                </span>
              )}
              {!s.done && s.kind === 'D' && picked.has(s.firstName) && (
                <span style={{ display: 'block', marginTop: 6 }}>
                  <Button small disabled={a.busy} onClick={() => tap(s.id, 'dropped-off')}>Dropped off · collected {fmtJod(cashFor(s.firstName))}</Button>
                </span>
              )}
            </span>
            <span className="t-body" style={{ fontWeight: 500 }}>{s.done ? <span style={{ color: 'var(--success-text)' }}><Icon name="check" label="done" /></span> : s.kind === 'P' && s.cashDueJod !== undefined ? fmtJod(s.cashDueJod) : ''}</span>
          </div>
        ))}
      </div>
      <ErrorNote text={a.message} />
    </div>
  );
}

function CancelSheet({ rideId, onClose }: { rideId: string; onClose: () => void }) {
  const a = useAction();
  const nav = useNavigate();
  return (
    <Sheet onClose={onClose}>
      <h2 className="t-h2">Cancel this trip?</h2>
      <p className="t-body text-2">More than 15 minutes before the first pickup, the riders go back to finding a driver. Later, the ride is canceled for everyone.</p>
      <ErrorNote text={a.message} />
      <Button onClick={onClose}>Keep the trip</Button>
      <Button kind="danger" disabled={a.busy} onClick={() => a.run(async () => { await api.driverCancel(rideId); nav('/driver'); })}>Cancel trip</Button>
    </Sheet>
  );
}

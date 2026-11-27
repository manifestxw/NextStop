// Ride status (DESIGN §7): stage track, Sync Pass, chat card, locations, leave. Ready check + leave sheets.
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import type { RiderRideView, RiderView } from '@nextstop/shared';
import { api } from '../net/api.js';
import { useSession } from '../state/session.js';
import { useDraft } from '../state/draft.js';
import { countdown, fmtJod, fmtTime } from '../lib/format.js';
import { useNow } from '../lib/useNow.js';
import { Button, CategoryBadge, ErrorNote, GenderBadge, MapPanel, MergeMark, Ring, SeatMeter, Sheet, Square, useAction } from '../components/ui.js';

const STAGES = ['Syncing', 'Ready check', 'Finding driver', 'Driver set'];
const stageOf = (s: RiderRideView['state']) => ({ OPEN: 0, READY_CHECK: 1, DISPATCHED: 2, ACCEPTED: 3, IN_PROGRESS: 3, COMPLETED: 4, CANCELED: 4 })[s];
const MAX: Record<RiderRideView['category'], number> = { economy: 4, comfort: 3, airport: 3 };

export function Status() {
  const view = useSession((s) => s.view) as RiderView | null;
  const d = useDraft();
  const nav = useNavigate();
  const [leaving, setLeaving] = useState(false);
  const a = useAction();
  const ride = view?.ride;
  if (!view || !ride || d.dismissed.includes(ride.id)) return <Navigate to="/" replace />;
  if (ride.state === 'COMPLETED') return <Navigate to={`/ride/${ride.id}/summary`} replace />;
  if (ride.state === 'CANCELED') {
    return (
      <main className="screen" style={{ justifyContent: 'center' }}>
        <MergeMark size={96} />
        <h1 className="t-h1">This ride was canceled</h1>
        <p className="t-body text-2">No fees were charged. You can plan another ride now.</p>
        <div className="dock"><Button onClick={() => { d.dismiss(ride.id); nav('/'); }}>Done</Button></div>
      </main>
    );
  }
  const stage = stageOf(ride.state);
  const filled = ride.seats.length;
  const title = ['Syncing riders', 'Ready check', 'Finding your driver', 'Driver on the way'][stage]!;
  const subtitle = [
    `${filled} of ${filled + ride.seatsLeft} synced`,
    `${ride.readyCheck?.answers.filter((x) => x.status === 'READY').length ?? 0} of ${filled} ready`,
    'Your ride is set',
    ride.driver ? `${ride.driver.firstName} · ${ride.driver.car}` : '',
  ][stage];
  const unread = ride.chat.group.filter((m) => m.seq > (d.chatSeen[ride.id] ?? 0) && m.fromUserId !== view.me.id).length;
  const last = ride.chat.group.at(-1);

  return (
    <main className="screen screen--flush" style={{ paddingTop: 0 }}>
      <MapPanel pickup={ride.myPickup.name} dest={ride.myDest.name} pulse={stage < 3} />
      <div className="stack" style={{ padding: '0 var(--pad-x)', gap: 'var(--s-3)' }}>
        <div className="stages" aria-label="Progress">
          {STAGES.map((s, i) => <div key={s} className={`stage${i < stage ? ' stage--done' : i === stage ? ' stage--now' : ''}`}><span className="stage-mark" /><span>{s}</span></div>)}
        </div>
        <div className="row" style={{ gap: 10 }}>{stage === 2 && <MergeMark />}<h1 className="t-h1">{title}</h1></div>
        <p className="t-body text-2" style={{ marginTop: -8 }}>{subtitle}
          {stage === 3 && ride.driver && <> · <span className="badge badge--raised" style={{ border: '1px solid var(--text-1)' }}>{ride.driver.plate}</span></>}</p>

        <section className="pass" aria-label="Your ride">
          <div className="pass-top">
            <div className="row row--between"><span className="t-eyebrow truncate">{ride.myPickup.area} → {ride.myDest.area}</span><CategoryBadge category={ride.category} /></div>
            <span className="t-eyebrow text-2">Be ready by</span>
            <span className="pass-time"><span className="t-hero">{fmtTime(ride.beReadyBy).replace(/ [AP]M$/, '')}</span>
              <span className="t-body-l" style={{ fontWeight: 600 }}>{fmtTime(ride.beReadyBy).slice(-2)}</span></span>
            <span className="t-body text-2">Pickup {ride.myStop.index} of {ride.myStop.of} · Arrive by {fmtTime(ride.effectiveArriveBy)}</span>
          </div>
          <div className="pass-perf" />
          <div className="pass-bottom">
            <SeatMeter seats={ride.seats} max={MAX[ride.category]} closed={stage > 0} />
            <span className="t-body" style={{ fontWeight: 600 }}>{filled} of {filled + ride.seatsLeft} synced</span>
            <div className="row row--between"><span className="row" style={{ gap: 6, alignItems: 'baseline' }}><span className="t-big">{fmtJod(ride.shareJod)}</span><span className="t-body text-2">each</span></span>
              <GenderBadge mode={ride.genderMode} gender={view.me.gender} /></div>
          </div>
        </section>

        <button type="button" className="card card--tight" style={{ textAlign: 'left' }} onClick={() => nav(`/ride/${ride.id}/chat`)}>
          <span className="row"><span aria-hidden>💬</span><span className="grow t-body-l" style={{ fontWeight: 600 }}>Group chat</span>
            {unread > 0 && <span className="badge badge--fill">{unread}</span>}<span aria-hidden>›</span></span>
          {last && <span className="t-body text-2 truncate" style={{ display: 'block', marginTop: 4 }}>{last.fromFirstName ? `${last.fromFirstName}: ` : ''}{last.text}</span>}
        </button>

        <section className="card card--tight">
          <div className="card-row"><Ring /><span className="grow"><span className="t-caption text-2" style={{ display: 'block' }}>Start location</span><span className="t-body-l truncate" style={{ display: 'block' }}>{ride.myPickup.name}</span></span></div>
          <div className="card-row"><Square /><span className="grow"><span className="t-caption text-2" style={{ display: 'block' }}>Your destination</span><span className="t-body-l truncate" style={{ display: 'block' }}>{ride.myDest.name}</span></span></div>
          <div className="card-row"><span aria-hidden>💵</span><span className="grow t-body-l">Cash · {fmtJod(ride.myCashDueJod)}</span></div>
        </section>

        <button type="button" className="card card--tight row" style={{ color: 'var(--danger)', textAlign: 'left' }} onClick={() => setLeaving(true)}>
          <span aria-hidden>↩</span><span className="t-body-l" style={{ fontWeight: 600 }}>Leave ride</span>
        </button>
        <ErrorNote text={a.message} />
      </div>

      {ride.isHost && ride.state === 'OPEN' && (
        <div className="dock">
          <p className="t-caption text-2 center">Starts automatically at {fmtTime(ride.findDriverAutoAt)}</p>
          <Button disabled={a.busy} onClick={() => a.run(() => api.findDriver(ride.id))}>Find driver</Button>
        </div>
      )}
      {ride.state === 'READY_CHECK' && !leaving && <ReadyCheck ride={ride} />}
      {leaving && <LeaveSheet ride={ride} onClose={() => setLeaving(false)} onLeft={() => nav('/')} />}
    </main>
  );
}

function ReadyCheck({ ride }: { ride: RiderRideView }) {
  const now = useNow();
  const a = useAction();
  const rc = ride.readyCheck!;
  const left = Date.parse(rc.endsAt) - now;
  const meReady = ride.seats.find((s) => s.isMe)?.ready === 'READY';
  const frac = Math.max(0, Math.min(1, left / 300_000));
  return (
    <Sheet>
      <h2 className="t-h2">Ready to ride?</h2>
      <p className="t-body text-2">{rc.startedByFirstName} started the ready check. No answer counts as ready.</p>
      <div className="ring">
        <svg viewBox="0 0 132 132"><circle cx="66" cy="66" r="60" fill="none" stroke="var(--raised)" strokeWidth="6" />
          <circle cx="66" cy="66" r="60" fill="none" stroke="var(--accent)" strokeWidth="6" strokeDasharray={`${377 * frac} 377`} strokeLinecap="round" /></svg>
        <span className="t-hero" style={{ fontSize: 40, color: left < 60_000 ? 'var(--warn)' : undefined }}>{countdown(left)}</span>
      </div>
      <SeatMeter seats={ride.seats} max={ride.seats.length} closed />
      <div className="stack">
        {rc.answers.map((x, i) => (
          <div key={i} className="row row--between t-body-l"><span>{x.firstName}</span>
            <span style={{ color: x.status === 'READY' ? 'var(--success)' : x.status === 'LEFT' ? 'var(--danger)' : 'var(--text-2)', fontWeight: 600 }}>
              {x.status === 'READY' ? 'Ready ✓' : x.status === 'LEFT' ? 'Left' : 'Waiting…'}</span></div>
        ))}
      </div>
      <ErrorNote text={a.message} />
      {meReady
        ? <p className="center t-body" style={{ color: 'var(--success)', fontWeight: 600, background: 'var(--success-soft)', borderRadius: 'var(--r-pill)', padding: 12 }}>You're ready. Waiting for others…</p>
        : <Button disabled={a.busy} onClick={() => a.run(() => api.ready(ride.id, 'READY'))}>I'm ready</Button>}
      <Button kind="secondary" disabled={a.busy} onClick={() => a.run(() => api.ready(ride.id, 'CANCEL'))}>Cancel ride for me</Button>
      <p className="t-caption text-2 center">Leaving now is free.</p>
    </Sheet>
  );
}

function LeaveSheet({ ride, onClose, onLeft }: { ride: RiderRideView; onClose: () => void; onLeft: () => void }) {
  const a = useAction();
  // The server says whether leaving now is free and what it costs; a 409 means it changed meanwhile.
  const lateCharge = a.error?.code === 'LATE_CONFIRM_REQUIRED' ? a.error.chargeJod ?? ride.leave.chargeJod : ride.leave.free ? null : ride.leave.chargeJod;
  const leave = () => a.run(async () => { await api.leave(ride.id, { acceptCharge: lateCharge !== null }); onLeft(); });
  return (
    <Sheet onClose={onClose}>
      <h2 className="t-h2">Leave this ride?</h2>
      {lateCharge === null ? (
        <p className="t-body text-2">Leaving now is free. Others' shares will update.</p>
      ) : (
        <>
          <p className="t-body">Your driver is already booked and pickup is in less than 30 minutes.</p>
          <div className="amount-box"><span className="t-body">You'll pay your share</span><span className="t-big" style={{ color: 'var(--danger)', fontSize: 24 }}>{fmtJod(lateCharge)}</span></div>
          <p className="t-caption text-2">Added as an outstanding balance on your next ride.</p>
        </>
      )}
      {a.error?.code !== 'LATE_CONFIRM_REQUIRED' && <ErrorNote text={a.message} />}
      <Button onClick={onClose}>Keep my seat</Button>
      <Button kind="danger" disabled={a.busy} onClick={leave}>{lateCharge === null ? 'Leave ride' : 'Leave anyway'}</Button>
    </Sheet>
  );
}

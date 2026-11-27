// Ride status (DESIGN §7): stage track, Sync Pass, chat card, locations, leave. Ready check + leave sheets.
import { MapView } from '../components/MapView.js';
import { Flap } from '../components/Flap.js';
import { Icon } from '../components/Icon.js';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import type { RiderRideView, RiderView } from '@nextstop/shared';
import { api } from '../net/api.js';
import { useSession } from '../state/session.js';
import { useDraft } from '../state/draft.js';
import { countdown, fmtJod, fmtTime } from '../lib/format.js';
import { useNow } from '../lib/useNow.js';
import { Button, CategoryBadge, ErrorNote, GenderBadge, MergeMark, Ring, SeatMeter, Sheet, Square, useAction } from '../components/ui.js';

const STAGES = ['Syncing', 'Ready check', 'Finding driver', 'Driver set'];
const stageOf = (s: RiderRideView['state']) => ({ OPEN: 0, READY_CHECK: 1, DISPATCHED: 2, ACCEPTED: 3, IN_PROGRESS: 3, COMPLETED: 4, CANCELED: 4 })[s];
const MAX: Record<RiderRideView['category'], number> = { economy: 4, comfort: 3, airport: 3 };

export function Status() {
  const view = useSession((s) => s.view) as RiderView | null;
  const d = useDraft();
  const nav = useNavigate();
  const [leaving, setLeaving] = useState(false);
  const [solo, setSolo] = useState(false);
  const a = useAction();
  const { id } = useParams();
  const ride = view?.ride;
  if (view && id && ride?.id !== id) return <Gone />;   // stale tab or old link (SPEC §3.13)
  if (!view || !ride || d.dismissed.includes(ride.id)) return <Navigate to="/" replace />;
  if (ride.state === 'COMPLETED') return <Navigate to={`/ride/${ride.id}/summary`} replace />;
  if (ride.state === 'CANCELED') {
    const title = ride.cancelReason === 'no-driver' ? 'No driver found' : ride.cancelReason === 'driver-canceled' ? 'Your driver canceled' : 'This ride was canceled';
    const offerSolo = ride.cancelReason === 'no-driver' || ride.cancelReason === 'driver-canceled';
    return (
      <main className="screen" style={{ justifyContent: 'center' }}>
        <MergeMark size={96} />
        <h1 className="t-h1">{title}</h1>
        <p className="t-body text-2">No fees were charged.{offerSolo ? ' You can still get there with a solo ride.' : ' You can plan another ride now.'}</p>
        <div className="dock">
          {offerSolo && <Button onClick={() => setSolo(true)}>Book a solo ride · {fmtJod(ride.soloJod)}</Button>}
          <Button kind={offerSolo ? 'secondary' : 'primary'} onClick={() => { d.dismiss(ride.id); nav('/'); }}>Done</Button>
        </div>
        {solo && (
          <Sheet onClose={() => setSolo(false)}>
            <h2 className="t-h2">Book a solo ride</h2>
            <p className="t-body text-2">This opens a solo Jeeny booking for {ride.myPickup.name} → {ride.myDest.name}, about {fmtJod(ride.soloJod)}. In the demo the hand-off is mocked.</p>
            <Button onClick={() => { setSolo(false); d.dismiss(ride.id); nav('/'); }}>OK</Button>
          </Sheet>
        )}
      </main>
    );
  }
  const stage = stageOf(ride.state);
  const filled = ride.seats.length;
  const onBoard = !!ride.onBoard;
  const title = onBoard ? "You're in the car" : ['Syncing riders', 'Ready check', 'Finding your driver', 'Driver on the way'][stage]!;
  const subtitle = [
    `${filled} of ${filled + ride.seatsLeft} synced`,
    `${ride.readyCheck?.answers.filter((x) => x.status === 'READY').length ?? 0} of ${filled} ready`,
    'Your ride is set',
    ride.driver ? `${ride.driver.firstName} · ${ride.driver.car}` : '',
  ][stage];
  const shownSubtitle = onBoard ? `Picked up by ${ride.driver?.firstName ?? 'your driver'} · on the way to ${ride.myDest.area}` : subtitle;
  const unread = ride.chat.group.filter((m) => m.kind === 'user' && m.seq > (d.chatSeen[ride.id] ?? 0) && m.fromUserId !== view.me.id).length;
  const last = ride.chat.group.at(-1);

  return (
    <main className="screen screen--flush" style={{ paddingTop: 0 }}>
      <MapView marks={[
        ...(onBoard ? [] : [{ kind: 'pickup' as const, lat: ride.myPickup.lat, lng: ride.myPickup.lng, label: ride.myPickup.name, me: stage < 3 }]),
        { kind: 'dest', lat: ride.myDest.lat, lng: ride.myDest.lng, label: ride.myDest.name },
      ]} />
      <div className="stack" style={{ padding: '0 var(--pad-x)', gap: 'var(--s-3)' }}>
        <div className="stages" aria-label="Progress">
          {STAGES.map((s, i) => <div key={s} className={`stage${i < stage ? ' stage--done' : i === stage ? ' stage--now' : ''}`}><span className="stage-mark" /><span>{s}</span></div>)}
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <div className="row" style={{ gap: 10 }}>{stage === 2 && <MergeMark loading />}<h1 className="t-h1">{title}</h1></div>
          <p className="t-body text-2">{shownSubtitle}
          {stage === 3 && !onBoard && ride.driver && <> · <span className="badge badge--raised" style={{ border: '1px solid var(--text-1)' }}>{ride.driver.plate}</span></>}</p>
        </div>

        <section className="pass" aria-label="Your ride">
          <div className="pass-top">
            <div className="row row--between"><span className="t-eyebrow truncate">{ride.myPickup.area} → {ride.myDest.area}</span><CategoryBadge category={ride.category} /></div>
            {onBoard ? <span className="row" style={{ gap: 6 }}><span className="badge badge--fill"><Icon name="check" size={14} /> Picked up</span></span>
              : <span className="t-eyebrow text-2">Be ready by</span>}
            {(() => { const t = fmtTime(onBoard ? ride.effectiveArriveBy : ride.beReadyBy); return (
              <span className="pass-time"><Flap className="t-hero" value={t.replace(/ [AP]M$/, '')} /><span className="t-body-l" style={{ fontWeight: 600 }}>{t.slice(-2)}</span></span>); })()}
            <span className="t-body text-2">{onBoard ? `Arrive by · ${ride.myDest.name}` : `Pickup ${ride.myStop.index} of ${ride.myStop.of} · Arrive by ${fmtTime(ride.effectiveArriveBy)}`}</span>
          </div>
          <div className="pass-perf" />
          <div className="pass-bottom">
            <SeatMeter seats={ride.seats} max={MAX[ride.category]} closed={stage > 0} />
            <span className="t-body" style={{ fontWeight: 600 }}><Flap value={String(filled)} /> of {filled + ride.seatsLeft} synced</span>
            <div className="row row--between"><span className="row" style={{ gap: 6, alignItems: 'baseline' }}><span className="t-eyebrow">JOD</span><Flap className="t-big" value={(ride.uniDiscountJod ? ride.myCashDueJod : ride.shareJod).toFixed(2)} /><span className="t-body text-2">{ride.uniDiscountJod ? 'you pay' : 'each'}</span>
              {ride.uniDiscountJod ? <><span className="badge badge--accent">−20% Uni</span><s className="t-caption text-2">{ride.shareJod.toFixed(2)}</s></> : null}</span>
              <GenderBadge mode={ride.genderMode} gender={view.me.gender} /></div>
          </div>
        </section>

        <button type="button" className="card card--tight" style={{ textAlign: 'left' }} onClick={() => nav(`/ride/${ride.id}/chat`)}>
          <span className="row"><Icon name="message" /><span className="grow t-body-l" style={{ fontWeight: 600 }}>Group chat</span>
            {unread > 0 && <span className="badge badge--fill" aria-label={`${unread} unread`}>{unread}</span>}<span className="text-2"><Icon name="next" size={16} /></span></span>
          {last && <span className="t-body text-2 truncate" style={{ display: 'block', marginTop: 4 }}>{last.fromFirstName ? `${last.fromFirstName}: ` : ''}{last.text}</span>}
        </button>

        {ride.driver && (
          <div className="row" style={{ gap: 'var(--s-2)' }}>
            <button type="button" className="card card--tight row grow" style={{ textAlign: 'left' }} onClick={() => nav(`/ride/${ride.id}/driver-chat`)}>
              <Icon name="message" /><span className="grow t-body-l" style={{ fontWeight: 600 }}>Message {ride.driver.firstName}</span>
              {(ride.chat.driver?.length ?? 0) > 0 && <span className="t-caption text-2">{ride.chat.driver!.length}</span>}<span className="text-2"><Icon name="next" size={16} /></span>
            </button>
            {ride.driver.phone && <a className="card card--tight row" href={`tel:${ride.driver.phone}`} aria-label={`Call ${ride.driver.firstName}`} style={{ textDecoration: 'none', color: 'var(--text-1)', fontWeight: 600 }}>
              <Icon name="phone" /> Call</a>}
          </div>
        )}
        {ride.state === 'OPEN' && <FriendsCard ride={ride} />}

        <section className="card card--tight">
          <div className="card-row"><Ring /><span className="grow"><span className="t-caption text-2" style={{ display: 'block' }}>Start location</span><span className="t-body-l truncate" style={{ display: 'block' }}>{ride.myPickup.name}</span></span></div>
          <div className="card-row"><Square /><span className="grow"><span className="t-caption text-2" style={{ display: 'block' }}>Your destination</span><span className="t-body-l truncate" style={{ display: 'block' }}>{ride.myDest.name}</span></span></div>
          <div className="card-row"><span style={{ color: 'var(--success)' }}><Icon name="banknote" /></span><span className="grow t-body-l">Cash · {fmtJod(ride.myCashDueJod)}</span></div>
        </section>

        {ride.leave.canLeave ? (
          <button type="button" className="card card--tight row" style={{ color: 'var(--danger)', textAlign: 'left' }} onClick={() => setLeaving(true)}>
            <Icon name="logout" /><span className="t-body-l" style={{ fontWeight: 600 }}>Leave ride</span>
          </button>
        ) : <p className="t-caption text-2 center">You're in the car, so you can't leave this ride now. It ends when you're dropped off.</p>}
        <ErrorNote text={a.message} />
      </div>

      {ride.isHost && ride.state === 'OPEN' && (
        <div className="dock">
          <p className="t-caption text-2 center">{ride.fewDrivers ? 'Few drivers nearby, so it starts early · ' : ''}Starts automatically at {fmtTime(ride.findDriverAutoAt)}</p>
          <Button disabled={a.busy} onClick={() => a.run(() => api.findDriver(ride.id))}>Find driver</Button>
        </div>
      )}
      {ride.state === 'READY_CHECK' && !leaving && <ReadyCheck ride={ride} />}
      {leaving && ride.leave.canLeave && <LeaveSheet ride={ride} onClose={() => setLeaving(false)} onLeft={() => nav('/')} />}
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
            <span style={{ color: x.status === 'READY' ? 'var(--success-text)' : x.status === 'LEFT' ? 'var(--danger)' : 'var(--text-2)', fontWeight: 600 }}>
              {x.status === 'READY' ? 'Ready ✓' : x.status === 'LEFT' ? 'Left' : 'Waiting…'}</span></div>
        ))}
      </div>
      <ErrorNote text={a.message} />
      {meReady
        ? <p className="center t-body" style={{ color: 'var(--success-text)', fontWeight: 600, background: 'var(--success-soft)', borderRadius: 'var(--r-pill)', padding: 12 }}>You're ready. Waiting for others…</p>
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

/** A link or tab to a ride this phone no longer has. */
function Gone() {
  const nav = useNavigate();
  return (
    <main className="screen" style={{ justifyContent: 'center' }}>
      <MergeMark size={96} />
      <h1 className="t-h1">This ride is no longer available</h1>
      <p className="t-body text-2">It was canceled, completed or replaced by a newer ride.</p>
      <div className="dock"><Button onClick={() => nav('/')}>Go home</Button></div>
    </main>
  );
}

/** Friends card (DESIGN §7, SPEC §3.17), while the ride is still taking riders. */
function FriendsCard({ ride }: { ride: RiderRideView }) {
  const [sheet, setSheet] = useState<'guest' | 'invite' | null>(null);
  const a = useAction();
  const late = a.error?.code === 'LATE_CONFIRM_REQUIRED';
  return (
    <section className="card card--tight">
      {ride.myGuest ? (
        <div className="card-row">
          <Icon name="userPlus" />
          <span className="grow t-body-l">{ride.myGuest.firstName} rides with you · {fmtJod(ride.shareJod)} <span className="t-caption text-2">(pays own share)</span></span>
          <button type="button" className="linkbtn" disabled={a.busy} onClick={() => a.run(() => api.removeGuest(ride.id, late))}>{late ? `Remove · pay ${fmtJod(a.error!.chargeJod ?? 0)}` : 'Remove'}</button>
        </div>
      ) : (
        <button type="button" className="card-row" style={{ width: '100%', background: 'none', border: 0, textAlign: 'left' }} onClick={() => setSheet('guest')} disabled={ride.seatsLeft === 0}>
          <Icon name="userPlus" /><span className="grow t-body-l">Add a friend (+1)</span><span className="text-2"><Icon name="next" size={16} /></span>
        </button>
      )}
      <button type="button" className="card-row" style={{ width: '100%', background: 'none', border: 0, textAlign: 'left' }} onClick={() => setSheet('invite')}>
        <Icon name="ticket" /><span className="grow t-body-l">Invite with a friend code</span><span className="text-2"><Icon name="next" size={16} /></span>
      </button>
      {(ride.sentInvites ?? []).map((i) => (
        <div key={i.id} className="card-row">
          <span className="picker-icon" style={{ width: 32, height: 32 }}>{i.firstName[0]}</span>
          <span className="grow t-body-l">{i.firstName}</span>
          <span className={`status-pill${i.state === 'joined' ? ' status-pill--ok' : i.state === 'waiting' ? '' : ' status-pill--off'}`}>
            {{ waiting: 'Invite sent · waiting', joined: 'Joined', declined: 'Declined', expired: 'Expired' }[i.state]}</span>
        </div>
      ))}
      {!late && <ErrorNote text={a.message} />}
      {sheet === 'guest' && <AddGuestSheet ride={ride} onClose={() => setSheet(null)} />}
      {sheet === 'invite' && <InviteSheet ride={ride} onClose={() => setSheet(null)} />}
    </section>
  );
}

function AddGuestSheet({ ride, onClose }: { ride: RiderRideView; onClose: () => void }) {
  const view = useSession((s) => s.view) as RiderView;
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'F' | 'M' | null>(ride.genderMode === 'same' ? view.me.gender : null);
  const a = useAction();
  const lockGender = ride.genderMode === 'same';
  return (
    <Sheet onClose={onClose}>
      <h2 className="t-h2">Add a friend</h2>
      <p className="t-body text-2">They ride with you from your pickup and pay their own share in cash.</p>
      <input className="field" placeholder="First name" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} aria-label="Friend's first name" />
      <div className="chips">
        {(['F', 'M'] as const).map((g) => (
          <button key={g} type="button" className={`chip${gender === g ? ' chip--on' : ''}`} aria-pressed={gender === g}
            disabled={lockGender && g !== view.me.gender} onClick={() => setGender(g)}>{g === 'F' ? 'Woman' : 'Man'}</button>
        ))}
      </div>
      {lockGender && <p className="t-caption text-2">This ride is {view.me.gender === 'F' ? 'women' : 'men'} only</p>}
      <p className="t-caption text-2">If you leave late, their share goes on your balance.</p>
      <ErrorNote text={a.message} />
      <Button disabled={!name.trim() || !gender || a.busy} onClick={() => a.run(async () => { await api.addGuest(ride.id, { firstName: name, gender: gender! }); onClose(); })}>
        Add {name.trim() || 'friend'}
      </Button>
    </Sheet>
  );
}

function InviteSheet({ ride, onClose }: { ride: RiderRideView; onClose: () => void }) {
  const [code, setCode] = useState('');
  const [friend, setFriend] = useState<{ code: string; name: string } | null>(null);
  const [lookErr, setLookErr] = useState<string | null>(null);
  const a = useAction();
  useEffect(() => {
    setFriend(null); setLookErr(null);
    if (code.length !== 6) return;
    let live = true;
    api.lookupCode(code).then((f) => { if (live) setFriend({ code, name: f.firstName }); }).catch((e: Error) => { if (live) setLookErr(e.message); });
    return () => { live = false; };
  }, [code]);
  return (
    <Sheet onClose={onClose}>
      <h2 className="t-h2">Invite a friend</h2>
      <p className="t-body text-2">Type the 6-character code from their RideSync home screen. They pick their own pickup and pay their own share.</p>
      <input className="field t-big" style={{ textAlign: 'center', letterSpacing: '0.2em', textTransform: 'uppercase' }} value={code} maxLength={6}
        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} aria-label="Friend code" autoCapitalize="characters" autoComplete="off" />
      {friend && <p className="row t-body-l" style={{ gap: 8 }}><span style={{ color: 'var(--success-text)' }}><Icon name="check" /></span>{friend.name}</p>}
      <ErrorNote text={a.message ?? lookErr} />
      <Button disabled={!friend || a.busy} onClick={() => a.run(async () => { await api.invite(ride.id, code); onClose(); })}>
        {friend ? `Invite ${friend.name}` : 'Send invite'}
      </Button>
    </Sheet>
  );
}

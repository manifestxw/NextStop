// "Rides going your way" (DESIGN §7): matching rides first, then "Start your own sync".
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import type { MatchCard } from '@nextstop/shared';
import type { RiderView } from '@nextstop/shared';
import { api } from '../net/api.js';
import { useSession } from '../state/session.js';
import { placeName, useDraft } from '../state/draft.js';
import { arriveByIso, fmtJod, fmtTime } from '../lib/format.js';
import { useNow } from '../lib/useNow.js';
import { Button, ErrorNote, GenderBadge, MergeMark, RoutePair, SeatMeter, useAction } from '../components/ui.js';

export const tripBody = (d: ReturnType<typeof useDraft.getState>, now: number, sameGenderOnly: boolean) => ({
  pickup: { key: d.pickupKey! }, dest: { key: d.destKey! }, arriveBy: arriveByIso(now, d.time), category: d.category, sameGenderOnly,
});

export function SharedList() {
  const d = useDraft();
  const now = useNow();
  const nav = useNavigate();
  const view = useSession((s) => s.view) as RiderView | null;
  const sameGender = d.sameGenderOnly ?? view?.me.sameGenderOnly ?? true;
  const [cards, setCards] = useState<MatchCard[] | null>(null);
  const a = useAction();
  const body = d.pickupKey && d.destKey ? tripBody(d, now, sameGender) : null;
  const key = JSON.stringify(body && { ...body, arriveBy: body.arriveBy });
  useEffect(() => {
    if (!body) return;
    void a.run(async () => setCards(await api.search(body)));
  }, [key]);   // re-search only when the trip itself changes
  if (!body) return <Navigate to="/" replace />;

  const join = (rideId: string) => a.run(async () => { await api.join(rideId, body); nav(`/ride/${rideId}`); });
  return (
    <main className="screen">
      <div className="row"><button type="button" className="iconbtn" aria-label="Back" onClick={() => nav('/')}>‹</button>
        <span className="t-eyebrow grow center">Rides going your way</span><span style={{ width: 44 }} /></div>
      <div className="card card--tight row" style={{ background: 'var(--raised)', border: 0 }}>
        <span className="grow"><span className="t-eyebrow" style={{ display: 'block' }}>{placeName(d.pickupKey)} → {placeName(d.destKey)}</span>
          <span className="t-body text-2">Arrive by {fmtTime(body.arriveBy)} · {d.category} · {sameGender ? 'Same gender' : 'Mixed'}</span></span>
        <button type="button" className="linkbtn" onClick={() => nav('/')}>Edit</button>
      </div>
      <ErrorNote text={a.message} />
      {cards === null && <p className="t-body text-2 center"><MergeMark /> Looking for rides…</p>}
      {cards?.length === 0 && (
        <div className="stack center" style={{ alignItems: 'center', marginTop: 'var(--s-8)' }}>
          <MergeMark size={96} />
          <h2 className="t-h2">No rides to sync yet</h2>
          <p className="t-body text-2" style={{ maxWidth: 300 }}>Start one and people going your way can join.</p>
        </div>
      )}
      {cards?.map((c) => (
        <article key={c.rideId} className="card stack" style={{ gap: 'var(--s-3)' }}>
          <div className="row row--between">
            <span className="row" style={{ gap: 8 }}><span className="t-h2" style={{ fontSize: 17 }}>{c.hostFirstName}</span><GenderBadge mode={c.genderMode} gender={c.gender} /></span>
            <span className="t-caption" style={{ color: 'var(--accent-text)' }}>{c.seatsLeft} seat{c.seatsLeft === 1 ? '' : 's'} left</span>
          </div>
          <SeatMeter mini max={c.seats.length + c.seatsLeft} seats={c.seats.map((s) => ({ initials: s.initials, isMe: false, isHost: false, ...(s.isGuest ? { guestOf: '' } : {}) }))} />
          <RoutePair from={c.pickupArea} to={c.destArea} />
          <p className="t-body text-2">Arrives by {fmtTime(c.effectiveArriveBy)} · Pickup ~{fmtTime(c.myPickupAt)}</p>
          <p className="row" style={{ gap: 6, alignItems: 'baseline' }}><span className="t-big">{fmtJod(c.myPaysJod)}</span><span className="t-body text-2">each if you join</span></p>
          <Button disabled={a.busy} onClick={() => join(c.rideId)}>Join · {fmtJod(c.myPaysJod)}</Button>
        </article>
      ))}
      <div className="dock">
        <Button kind={cards?.length === 0 ? 'primary' : 'secondary'} onClick={() => nav('/shared/new')}>Start your own sync</Button>
      </div>
    </main>
  );
}

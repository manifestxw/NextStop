// Chat (DESIGN §8): the group thread, a rider's thread with the driver, and the driver's thread per rider.
// Messages arrive masked from the server; bubbles use dir="auto" for Arabic.
import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import type { ChatMessageView, DriverView, RiderView } from '@nextstop/shared';
import { api } from '../net/api.js';
import { useSession } from '../state/session.js';
import { useDraft } from '../state/draft.js';
import { fmtTime } from '../lib/format.js';
import { Icon } from '../components/Icon.js';
import { ErrorNote, SeatMeter, useAction } from '../components/ui.js';

interface ThreadProps {
  title: string; meId: string; messages: ChatMessageView[]; closed: boolean; placeholder: string;
  back: string; header?: React.ReactNode; send: (text: string) => Promise<unknown>; onSeen?: (seq: number) => void;
}

function Thread({ title, meId, messages: msgs, closed, placeholder, back, header, send, onSeen }: ThreadProps) {
  const nav = useNavigate();
  const [text, setText] = useState('');
  const a = useAction();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); if (msgs.length) onSeen?.(msgs.at(-1)!.seq); }, [msgs, onSeen]);
  return (
    <main className="chat">
      <header className="chat-head">
        <div className="row" style={{ width: '100%' }}><button type="button" className="iconbtn" aria-label="Back" onClick={() => nav(back)}><Icon name="back" /></button>
          <span className="t-eyebrow grow center">{title}</span><span style={{ width: 44 }} /></div>
        {header}
      </header>
      <div className="chat-log">
        {msgs.length === 0 && <p className="chat-sys">No messages yet</p>}
        {msgs.map((m, i) => {
          if (m.kind === 'system') return <p key={m.id} className="chat-sys">{m.text}</p>;
          const mine = m.fromUserId === meId;
          const prev = msgs[i - 1], next = msgs[i + 1];
          const first = prev?.fromUserId !== m.fromUserId || prev?.kind === 'system';
          const lastOfGroup = next?.fromUserId !== m.fromUserId || next?.kind === 'system';
          return (
            <div key={m.id} className={`bubble-wrap${mine ? ' bubble-wrap--me' : ''}`}>
              {!mine && first && <span className="t-caption text-2">{m.fromFirstName}</span>}
              <span className="bubble" dir="auto">{m.text}</span>
              {lastOfGroup && <span className="t-caption text-2" style={{ fontSize: 12 }}>{fmtTime(m.at)}</span>}
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <ErrorNote text={a.message} />
      {closed ? <p className="center t-body text-2" style={{ background: 'var(--raised)', padding: 16 }}>This chat is closed</p> : (
        <form className="chat-input" onSubmit={(e) => { e.preventDefault(); if (text.trim()) void a.run(async () => { await send(text); setText(''); }); }}>
          <div className="grow stack" style={{ gap: 2 }}>
            {text.length > 250 && <span className="t-caption text-2" style={{ fontSize: 12 }}>{text.length}/300</span>}
            <input value={text} maxLength={300} dir="auto" placeholder={placeholder} onChange={(e) => setText(e.target.value)} aria-label="Message" />
          </div>
          <button type="submit" className="send" disabled={!text.trim() || a.busy} aria-label="Send"><Icon name="send" /></button>
        </form>
      )}
    </main>
  );
}

/** Group chat (riders only). */
export function Chat() {
  const view = useSession((s) => s.view) as RiderView | null;
  const seen = useDraft((s) => s.seenChat);
  const ride = view?.ride;
  if (!view || !ride) return <Navigate to="/" replace />;
  return (
    <Thread title={`To ${ride.myDest.area} · ${fmtTime(ride.effectiveArriveBy)}`} meId={view.me.id} messages={ride.chat.group}
      closed={ride.state === 'COMPLETED' || ride.state === 'CANCELED'} placeholder="Message the group…" back={`/ride/${ride.id}`}
      header={<div style={{ width: 200 }}><SeatMeter mini seats={ride.seats} max={ride.seats.length + ride.seatsLeft} closed={ride.state !== 'OPEN'} /></div>}
      send={(t) => api.chat(ride.id, t)} onSeen={(seq) => seen(ride.id, seq)} />
  );
}

/** A rider's private thread with the driver (P1). */
export function DriverChat() {
  const view = useSession((s) => s.view) as RiderView | null;
  const ride = view?.ride;
  if (!view || !ride?.driver) return <Navigate to="/" replace />;
  return (
    <Thread title={`${ride.driver.firstName} · Driver`} meId={view.me.id} messages={ride.chat.driver ?? []}
      closed={ride.state === 'COMPLETED' || ride.state === 'CANCELED'} placeholder="Message your driver…" back={`/ride/${ride.id}`}
      send={(t) => api.chat(ride.id, t, `driver:${view.me.id}`)} />
  );
}

/** The driver's private thread with one rider (P1). */
export function DriverRiderChat() {
  const view = useSession((s) => s.view) as DriverView | null;
  const { id, riderId } = useParams();
  const t = view?.trip;
  if (!view || !t || t.rideId !== id || !riderId) return <Navigate to="/driver" replace />;
  const name = t.stops.find((s) => s.id === `P-${riderId}`)?.firstName ?? 'Rider';
  return (
    <Thread title={name} meId={view.me.id} messages={t.chats?.[riderId] ?? []} closed={t.state === 'COMPLETED'}
      placeholder={`Message ${name}…`} back={`/driver/trip/${t.rideId}`} send={(x) => api.chat(t.rideId, x, `driver:${riderId}`)} />
  );
}

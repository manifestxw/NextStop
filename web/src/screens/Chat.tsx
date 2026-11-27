// Group chat (DESIGN §8): last 100 messages, masked by the server, bubbles with dir="auto".
import { Icon } from '../components/Icon.js';
import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import type { RiderView } from '@nextstop/shared';
import { api } from '../net/api.js';
import { useSession } from '../state/session.js';
import { useDraft } from '../state/draft.js';
import { fmtTime } from '../lib/format.js';
import { ErrorNote, SeatMeter, useAction } from '../components/ui.js';

export function Chat() {
  const view = useSession((s) => s.view) as RiderView | null;
  const seen = useDraft((s) => s.seenChat);
  const nav = useNavigate();
  const [text, setText] = useState('');
  const a = useAction();
  const end = useRef<HTMLDivElement>(null);
  const ride = view?.ride;
  const msgs = ride?.chat.group ?? [];
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); if (ride && msgs.length) seen(ride.id, msgs.at(-1)!.seq); }, [msgs.length, ride, seen, msgs]);
  if (!view || !ride) return <Navigate to="/" replace />;
  const closed = ride.state === 'COMPLETED' || ride.state === 'CANCELED';
  const send = () => a.run(async () => { await api.chat(ride.id, text); setText(''); });

  return (
    <main className="chat">
      <header className="chat-head">
        <div className="row" style={{ width: '100%' }}><button type="button" className="iconbtn" aria-label="Back" onClick={() => nav(`/ride/${ride.id}`)}><Icon name="back" /></button>
          <span className="t-eyebrow grow center">To {ride.myDest.area} · {fmtTime(ride.effectiveArriveBy)}</span><span style={{ width: 44 }} /></div>
        <div style={{ width: 200 }}><SeatMeter mini seats={ride.seats} max={ride.seats.length + ride.seatsLeft} closed={ride.state !== 'OPEN'} /></div>
      </header>
      <div className="chat-log">
        {msgs.map((m, i) => {
          if (m.kind === 'system') return <p key={m.id} className="chat-sys">{m.text}</p>;
          const mine = m.fromUserId === view.me.id;
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
        <form className="chat-input" onSubmit={(e) => { e.preventDefault(); if (text.trim()) void send(); }}>
          <div className="grow stack" style={{ gap: 2 }}>
            {text.length > 250 && <span className="t-caption text-2" style={{ fontSize: 12 }}>{text.length}/300</span>}
            <input value={text} maxLength={300} dir="auto" placeholder="Message the group…" onChange={(e) => setText(e.target.value)} aria-label="Message" />
          </div>
          <button type="submit" className="send" disabled={!text.trim() || a.busy} aria-label="Send"><Icon name="send" /></button>
        </form>
      )}
    </main>
  );
}

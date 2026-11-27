// Shared UI pieces (DESIGN §5–§6). Presentational only: everything they show comes from a server view.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { BannerView, Category, Gender, GenderMode, SeatView } from '@nextstop/shared';
import { api, ApiError } from '../net/api.js';
import { useSession } from '../state/session.js';
import { Icon } from './Icon.js';

export function Button({ kind = 'primary', small, ...p }: { kind?: 'primary' | 'secondary' | 'danger'; small?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...p} className={`btn btn--${kind}${small ? ' btn--small' : ''} ${p.className ?? ''}`} />;
}

/** Runs a command: disables its button while in flight (no double taps) and keeps the error to show. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    if (busy) return undefined;
    setBusy(true); setError(null);
    try { return await fn(); } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError('NETWORK', 'Something went wrong. Try again.'));
      return undefined;
    } finally { setBusy(false); }
  }
  return { busy, error, message: error?.message || null, clear: () => setError(null), run };
}

export const ErrorNote = ({ text }: { text: string | null }) => (text ? <p className="error-note" role="alert">{text}</p> : null);

export function Sheet({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <section className="sheet" role="dialog" aria-modal="true">{children}</section>
    </>
  );
}

export const Ring = () => <span className="mark-ring" aria-hidden />;
export const Square = () => <span className="mark-square" aria-hidden />;

export function RoutePair({ from, to }: { from: ReactNode; to: ReactNode }) {
  return (
    <div className="route-pair">
      <Ring /><span className="truncate">{from}</span>
      <span className="connector" /><span />
      <Square /><span className="truncate">{to}</span>
    </div>
  );
}

/** The Merge mark (§5): three lines merging into one that ends in the destination square.
 *  `loading` draws the lines in turn and repeats every 1.6 s (replaces any spinner); `done` plays once
 *  and fills the square in success (trip summary). */
export function MergeMark({ size = 32, done, loading }: { size?: number; done?: boolean; loading?: boolean }) {
  const mode = loading ? ' merge--loop' : done ? ' merge--done' : '';
  return (
    <svg className={`merge${mode}`} width={size} height={size * 0.6} viewBox="0 0 50 30" aria-hidden>
      <g fill="none" stroke="var(--text-1)" strokeWidth="3" strokeLinecap="round">
        <path className="merge-l1" pathLength={1} d="M2 4 C14 4 16 15 26 15" />
        <path className="merge-l2" pathLength={1} d="M2 15 H26" />
        <path className="merge-l3" pathLength={1} d="M2 26 C14 26 16 15 26 15" />
      </g>
      <path className="merge-trunk" pathLength={1} d="M26 15 H40" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" />
      <rect className="merge-end" x="40" y="9" width="10" height="12" />
    </svg>
  );
}

export function Logo() {
  return <span className="row" style={{ gap: 8 }}><MergeMark size={30} /><span className="t-h2">Ride<span style={{ color: 'var(--accent-text)' }}>Sync</span></span></span>;
}

export function GenderBadge({ mode, gender }: { mode: GenderMode; gender?: Gender }) {
  if (mode === 'mixed') return <span className="badge badge--raised">Mixed</span>;
  return <span className="badge badge--ink">{gender === 'M' ? 'Men only' : 'Women only'}</span>;
}

export const CategoryBadge = ({ category, fill }: { category: Category; fill?: boolean }) =>
  <span className={`badge ${fill ? 'badge--fill' : 'badge--accent'}`}>{category}</span>;

/** Seat meter (§5). `max` seats; empty ones are dashed, or solid once joining has closed.
 *  A seat that fills sweeps in left to right (300 ms); seats already filled on arrival don't move. */
export function SeatMeter({ seats, max, closed, mini }: { seats: Pick<SeatView, 'initials' | 'isMe' | 'isHost' | 'ready' | 'guestOf'>[]; max: number; closed?: boolean; mini?: boolean }) {
  const slots = Array.from({ length: max }, (_, i) => seats[i]);
  const box = useRef<HTMLDivElement>(null);
  const filled = useRef(seats.length);
  useLayoutEffect(() => {
    const before = filled.current;
    filled.current = seats.length;
    if (seats.length <= before || !box.current || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    box.current.querySelectorAll<HTMLElement>('.seat-dot:not(.seat-dot--empty)').forEach((dot, i) => {
      if (i >= before) dot.animate([{ clipPath: 'inset(0 100% 0 0 round 50%)' }, { clipPath: 'inset(0 0 0 0 round 50%)' }],
        { duration: 300, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
    });
  }, [seats.length]);
  return (
    <div ref={box} className={`seats${mini ? ' seats--mini' : ''}`}>
      {slots.map((s, i) => (
        <div className="seat" key={i}>
          {s ? (
            <>
              <span className={`seat-dot${s.isMe ? ' seat-dot--me' : ''}`} aria-label={s.guestOf ? `${s.initials}, with ${s.guestOf}` : s.initials}>{s.initials}</span>
              {s.ready && <span className={`seat-badge${s.ready === 'READY' ? '' : ' seat-badge--wait'}`} aria-label={s.ready === 'READY' ? 'ready' : 'waiting'}>{s.ready === 'READY' ? <Icon name="check" size={10} /> : ''}</span>}
              {!mini && <span className="t-eyebrow text-2" style={{ fontSize: 10 }}>{s.isHost ? 'Host' : s.guestOf ? '+1' : '\u00a0'}</span>}
            </>
          ) : (
            <>
              <span className={`seat-dot seat-dot--empty${closed ? ' seat-dot--closed' : ''}`} aria-label={closed ? 'closed seat' : 'free seat'}>{closed ? '' : '+'}</span>
              {!mini && <span className="t-eyebrow" style={{ fontSize: 10 }}>{'\u00a0'}</span>}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" onClick={() => onChange(!on)} />;
}

/** In-app banners (§6): newest unseen one, auto-hides after 4 s, tap to dismiss. Seen = told to the server. */
export function Banners({ banners }: { banners: BannerView[] }) {
  const b = banners[0];
  useEffect(() => {
    if (!b) return;
    const t = setTimeout(() => { void api.bannerSeen(b.id).catch(() => undefined); }, 4000);
    return () => clearTimeout(t);
  }, [b]);
  if (!b) return null;
  return <button type="button" className={`banner banner--${b.tone}`} onClick={() => void api.bannerSeen(b.id).catch(() => undefined)}>{b.text}</button>;
}

export function ConnectionBar() {
  const conn = useSession((s) => s.conn);
  return conn === 'reconnecting' ? <div className="conn" role="status">Reconnecting…</div> : null;
}

/** Map area until T14 wires Google Maps: your own pickup (ring, pulsing) and destination (square) only. */
export function MapPanel({ pickup, dest, pulse }: { pickup?: string; dest?: string; pulse?: boolean }) {
  return (
    <div className="map" aria-label="Map">
      {pickup && <span className="map-pin" style={{ left: '12%', top: '22%' }}><span className={pulse ? 'map-halo' : ''}><Ring /></span>{pickup}</span>}
      {dest && <span className="map-pin" style={{ right: '10%', bottom: '18%' }}><Square />{dest}</span>}
    </div>
  );
}

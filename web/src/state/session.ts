// Thin client state (ARCH §10): the latest view, the connection state and the server clock.
// Screens are pure functions of `view`. Nothing here decides prices, matching or ride state.
import { create } from 'zustand';
import type { ClockView, View } from '@nextstop/shared';
import { acceptView } from './acceptView.js';

const TOKEN_KEY = 'ridesync.token';
const readToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
const writeToken = (t: string | null) => {
  try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ }
};

export type Connection = 'offline' | 'connecting' | 'online' | 'reconnecting';

interface Session {
  token: string | null;
  view: View | null;
  conn: Connection;
  /** Server clock + the local time we received it, for countdowns (they freeze while paused). */
  clock: (ClockView & { receivedAtMs: number }) | null;
  login(token: string, view: View): void;
  logout(): void;
  setView(view: View): void;
  setClock(clock: ClockView): void;
  setConn(conn: Connection): void;
}

export const useSession = create<Session>((set, get) => ({
  token: readToken(),
  view: null,
  conn: 'offline',
  clock: null,
  // A new login drops the old baseline: its viewSeq belongs to another user/epoch.
  login(token, view) { writeToken(token); set({ token, view, clock: { ...view.clock, receivedAtMs: Date.now() } }); },
  logout() { writeToken(null); set({ token: null, view: null, clock: null, conn: 'offline' }); },
  setView(view) {
    if (!acceptView(get().view, view)) return;
    set({ view, clock: { ...view.clock, receivedAtMs: Date.now() } });
  },
  setClock(clock) { set({ clock: { ...clock, receivedAtMs: Date.now() } }); },
  setConn(conn) { set({ conn }); },
}));

/** Current demo time in epoch ms, from the server clock plus local elapsed time (frozen while paused). */
export function serverNowMs(clock: Session['clock']): number {
  if (!clock) return Date.now();
  const base = Date.parse(clock.nowIso);
  return clock.paused ? base : base + (Date.now() - clock.receivedAtMs);
}

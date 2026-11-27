// Socket.IO events, server → phone only (ARCH §9.2). Commands go over REST, never the socket.
import type { ChatMessageView, ClockView, MatchCard, View } from './views.js';

export interface ServerToClientEvents {
  view: (view: View) => void;               // full view, on connect and after commits touching this user
  chat: (message: ChatMessageView) => void; // also included in the next view
  search: (cards: MatchCard[]) => void;     // P1: live search for 60 s
  clock: (clock: ClockView) => void;        // every 30 s and right after a clock change
  logout: () => void;                       // demo reset
}

/** Push-only: the client never emits. */
export type ClientToServerEvents = Record<string, never>;

/** `io({ auth })` payload, checked with the epoch in the connection middleware. */
export interface SocketAuth { token: string }

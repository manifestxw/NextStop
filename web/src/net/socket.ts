// Socket.IO, server → phone only (ARCH §9). The full view on (re)connect is the catch-up.
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@nextstop/shared';
import { useSession } from '../state/session.js';

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

export function connectSocket(token: string) {
  disconnectSocket();
  const s = useSession.getState();
  s.setConn('connecting');
  socket = io({ path: '/socket.io', auth: { token } });
  socket.on('connect', () => { clearTimeout(reconnectTimer); useSession.getState().setConn('online'); });
  // "Reconnecting…" only after 2 s offline, so brief blips don't flash the banner (ARCH §9.2).
  socket.on('disconnect', () => {
    reconnectTimer = setTimeout(() => useSession.getState().setConn('reconnecting'), 2000);
  });
  socket.on('connect_error', (err) => {
    if (err.message === 'LOGGED_OUT') useSession.getState().logout();
    else reconnectTimer ??= setTimeout(() => useSession.getState().setConn('reconnecting'), 2000);
  });
  socket.on('view', (v) => useSession.getState().setView(v));
  socket.on('clock', (c) => useSession.getState().setClock(c));
  socket.on('logout', () => useSession.getState().logout());
  // `chat` events also arrive inside the next view, so the view alone is enough to render.
}

export function disconnectSocket() {
  clearTimeout(reconnectTimer);
  reconnectTimer = undefined;
  socket?.removeAllListeners();
  socket?.close();
  socket = null;
}

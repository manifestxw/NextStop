// Socket.IO on the same port (ARCH §9): auth on connect (token + epoch), one room per user,
// server → phone only. Views are projected per user by the commands layer; rooms only route them.
import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@nextstop/shared';
import type { Store } from '../store/repo.js';
import type { Publisher } from './publisher.js';

export function attachRealtime(http: HttpServer, store: Store) {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, { userId: string }>(http, {
    path: '/socket.io', pingInterval: 10_000, pingTimeout: 8_000,
  });
  let onConnect: (userId: string) => Promise<unknown> = async () => undefined;

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    const user = typeof token === 'string' ? await store.withLock(async (r) => {
      const [u, d] = [await r.getUserByToken(token), await r.getDemoState()];
      return u && d && u.epoch === d.epoch ? u : null;
    }) : null;
    if (!user) return next(new Error('LOGGED_OUT'));
    socket.data.userId = user.id;
    next();
  });

  io.on('connection', (socket) => {
    void socket.join(`user:${socket.data.userId}`);
    // The full view on connect IS the catch-up after a reconnect (ARCH §9.2).
    onConnect(socket.data.userId).catch((e) => console.error('initial view push failed:', e));
  });

  const room = (id: string) => io.to(`user:${id}`);
  const publisher: Publisher = {
    view: (id, v) => { room(id).emit('view', v); },
    chat: (id, m) => { room(id).emit('chat', m); },
    clock: (c) => { io.emit('clock', c); },
    logout: () => { io.emit('logout'); },
  };
  return { io, publisher, setOnConnect(fn: (userId: string) => Promise<unknown>) { onConnect = fn; } };
}

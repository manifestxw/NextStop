// Socket.IO over a real port: token + epoch auth, full view pushed on connect, live pushes after commits.
import { afterAll, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import type { View } from '@nextstop/shared';
import { buildApp } from '../src/app.js';
import { attachRealtime } from '../src/realtime/io.js';
import { createCommands } from '../src/commands/index.js';
import { makeHarness, trip } from './helpers.js';

const sockets: Socket[] = [];
let close: () => Promise<unknown> = async () => undefined;
afterAll(async () => { sockets.forEach((s) => s.close()); await close(); });

async function server() {
  const h = await makeHarness();
  const app = buildApp({ clock: h.clock });
  const rt = attachRealtime(app.server, h.store);
  const cmd = createCommands({ ...h.ctx, publisher: rt.publisher });
  rt.setOnConnect((id) => cmd.pushView(id));
  await app.listen({ port: 0, host: '127.0.0.1' });
  close = () => app.close();
  const url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  const open = (token: string) => {
    const s = connect(url, { path: '/socket.io', auth: { token }, transports: ['websocket'], reconnection: false });
    sockets.push(s);
    return s;
  };
  return { cmd, open };
}

const next = <T>(s: Socket, ev: string) => new Promise<T>((ok) => s.once(ev, ok));

describe('realtime', () => {
  it('pushes the full view on connect, then live views after another rider joins', async () => {
    const { cmd, open } = await server();
    const laith = (await cmd.demoLogin({ as: 'laith' })).token, saed = (await cmd.demoLogin({ as: 'saed' })).token;
    const created = await cmd.createRide(laith, trip('CC'));
    const s = open(laith);
    const first = await next<View>(s, 'view');
    expect(first.role).toBe('rider');
    const live = next<View>(s, 'view');
    await cmd.join(saed, (created as { ride: { id: string } }).ride.id, trip('US'));
    expect((await live as { ride: { shareJod: number } }).ride.shareJod).toBe(4.0);
  });

  it('refuses a bad token with LOGGED_OUT', async () => {
    const { open } = await server();
    const err = await next<Error>(open('nope'), 'connect_error');
    expect(err.message).toBe('LOGGED_OUT');
  });
});

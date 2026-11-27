// The HTTP layer (ARCH §7.1): bodies validated (422), Bearer auth (401), demo PIN (403),
// conflicts as 409 {code, message, ...extra}, views as 200 {ok, view}.
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { registerRoutes } from '../src/http/routes.js';
import { makeHarness } from './helpers.js';

async function api() {
  const h = await makeHarness();
  const app = buildApp({ clock: h.clock });
  registerRoutes(app, h.cmd, h.cfg);
  const call = async (method: 'GET' | 'POST', url: string, body?: unknown, headers: Record<string, string> = {}) => {
    const r = await app.inject({ method, url, payload: body as object, headers });
    return { status: r.statusCode, body: r.json() };
  };
  const pin = { 'x-demo-pin': h.cfg.demoPin };
  const login = async (as: string) => (await call('POST', '/api/demo/login', { as }, pin)).body.token as string;
  const bearer = (t: string) => ({ authorization: `Bearer ${t}` });
  return { h, call, pin, login, bearer };
}

const trip = { pickup: { key: 'CC' }, dest: { key: 'JUST' }, arriveBy: '2026-11-29T08:00:00+03:00', category: 'economy', sameGenderOnly: true };

describe('HTTP routes', () => {
  it('phone code → signup returns a token and view; me needs the Bearer token; log out ends it', async () => {
    const { call, bearer } = await api();
    const otp = await call('POST', '/api/otp/request', { phone: '079 555 0199' });
    expect([otp.status, otp.body.phone]).toEqual([200, '+962795550199']);
    const ver = await call('POST', '/api/otp/verify', { phone: '0795550199', code: otp.body.demoCode });
    const s = await call('POST', '/api/signup', { firstName: 'Maya', lastName: 'Khoury', gender: 'F', role: 'rider', ticket: ver.body.ticket });
    expect(s.status).toBe(200);
    expect(s.body.view.me.firstName).toBe('Maya');
    expect((await call('GET', '/api/me', undefined, bearer(s.body.token))).body).toMatchObject({ ok: true, view: { role: 'rider' } });
    expect(await call('GET', '/api/me')).toEqual({ status: 401, body: { code: 'LOGGED_OUT' } });
    expect((await call('POST', '/api/logout', {}, bearer(s.body.token))).status).toBe(200);
    expect((await call('GET', '/api/me', undefined, bearer(s.body.token))).status).toBe(401);
  });

  it('rejects an invalid body with 422 and the issues', async () => {
    const { call } = await api();
    const r = await call('POST', '/api/signup', { firstName: '', gender: 'X', role: 'rider' });
    expect(r.status).toBe(422);
    expect(r.body.code).toBe('INVALID');
    expect(r.body.issues.map((i: { path: string }) => i.path).sort()).toEqual(['firstName', 'gender', 'lastName', 'ticket']);
  });

  it('demo calls need the PIN (403 BAD_PIN)', async () => {
    const { call, pin } = await api();
    expect(await call('POST', '/api/demo/login', { as: 'laith' })).toEqual({ status: 403, body: { code: 'BAD_PIN' } });
    expect((await call('GET', '/api/demo', undefined, pin)).body.demo.clock.paused).toBe(true);
  });

  it('domain conflicts are 409 with the user-facing message', async () => {
    const { call, login, bearer } = await api();
    const laith = await login('laith');
    const r = await call('POST', '/api/rides', { ...trip, arriveBy: '2026-11-29T07:00:00+03:00' }, bearer(laith));
    expect(r).toEqual({ status: 409, body: { code: 'TOO_SOON', message: 'Too soon to sync. Book a solo ride instead.' } });
  });

  it('runs create → search → join → chat over HTTP', async () => {
    const { call, login, bearer } = await api();
    const laith = await login('laith'), saed = await login('saed');
    const q = await call('POST', '/api/quote', { pickup: trip.pickup, dest: trip.dest, arriveBy: trip.arriveBy }, bearer(laith));
    expect(q.body.quote.categories[0].fromJod).toBe(2.35);
    const created = await call('POST', '/api/rides', trip, bearer(laith));
    const rideId = created.body.view.ride.id;
    const found = await call('POST', '/api/search', { ...trip, pickup: { key: 'US' } }, bearer(saed));
    expect(found.body.cards[0]).toMatchObject({ rideId, eachJod: 4.0 });
    expect((await call('POST', `/api/rides/${rideId}/join`, { ...trip, pickup: { key: 'US' } }, bearer(saed))).body.view.ride.shareJod).toBe(4.0);
    const c = await call('POST', `/api/rides/${rideId}/chat`, { channel: 'group', text: 'my number 0791234567' }, bearer(saed));
    expect(c.body.view.ride.chat.group.at(-1).text).toBe('my number •••');
  });

  it('a late leave without acceptCharge is 409 LATE_CONFIRM_REQUIRED with chargeJod', async () => {
    const { call, login, bearer, pin } = await api();
    const laith = await login('laith'), yazeed = await login('yazeed');
    const rideId = (await call('POST', '/api/rides', trip, bearer(laith))).body.view.ride.id;
    await call('POST', `/api/rides/${rideId}/find-driver`, {}, bearer(laith));
    await call('POST', `/api/rides/${rideId}/ready`, { answer: 'READY' }, bearer(laith));
    expect((await call('POST', `/api/offers/${rideId}/accept`, {}, bearer(yazeed))).body.view.trip.rideId).toBe(rideId);
    await call('POST', '/api/demo/clock', { jumpTo: '2026-11-29T07:00:00+03:00' }, pin);
    const r = await call('POST', `/api/rides/${rideId}/leave`, {}, bearer(laith));
    expect(r).toEqual({ status: 409, body: { code: 'LATE_CONFIRM_REQUIRED', message: '', chargeJod: 7.85 } });
  });

  it('banners can be marked seen', async () => {
    const { h, call, login, bearer } = await api();
    const laith = await login('laith');
    await h.store.withLock((r) => r.addBanner({ id: 'b1', userId: 'u-laith', text: 'hi', tone: 'info', at: '2026-11-29T06:10:00.000+03:00', seen: false }));
    expect((await call('GET', '/api/me', undefined, bearer(laith))).body.view.banners).toHaveLength(1);
    expect((await call('POST', '/api/banners/b1/seen', {}, bearer(laith))).body.view.banners).toHaveLength(0);
  });
});

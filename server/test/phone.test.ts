// Phone sign-up with a demo OTP, profile, log out, and calling between a rider and their driver (owner request, 27 Nov).
import { describe, expect, it } from 'vitest';
import { makeHarness, trip, rider, driver } from './helpers.js';
import { ConflictError, LoggedOutError } from '../src/domain/errors.js';
import { normalizePhone } from '../src/domain/phone.js';

const code = async (p: Promise<unknown>) => {
  try { await p; return 'ok'; } catch (e) { if (e instanceof ConflictError) return e.code; if (e instanceof LoggedOutError) return 'LOGGED_OUT'; throw e; }
};

describe('Jordanian mobile numbers', () => {
  it('accepts the usual ways of writing one and stores +9627XXXXXXXX', () => {
    for (const p of ['0791234567', '079 123 4567', '+962791234567', '00962 79-123-4567', '962791234567', '791234567']) expect(normalizePhone(p)).toBe('+962791234567');
    expect(normalizePhone('0781234567')).toBe('+962781234567');
    for (const p of ['0761234567', '079123456', '06123456', '+97150123456', 'abc']) expect(normalizePhone(p)).toBeNull();
  });
});

describe('OTP sign-up (demo: the code is shown, not texted)', () => {
  it('new number: request → verify → sign up with the ticket; the phone is on the account', async () => {
    const h = await makeHarness();
    const r = await h.cmd.requestOtp({ phone: '079 555 0101' });
    expect([r.phone, /^\d{6}$/.test(r.demoCode), r.resendInSec, r.expiresInSec]).toEqual(['+962795550101', true, 30, 300]);
    const v = await h.cmd.verifyOtp({ phone: '0795550101', code: r.demoCode });
    expect('ticket' in v).toBe(true);
    const s = await h.cmd.signup({ firstName: 'Maya', lastName: 'Khoury', gender: 'F', role: 'rider', ticket: (v as { ticket: string }).ticket });
    expect(rider(s.view).me.phone).toBe('+962795550101');
    // The ticket works once.
    expect(await code(h.cmd.signup({ firstName: 'Maya', lastName: 'Khoury', gender: 'F', role: 'rider', ticket: (v as { ticket: string }).ticket }))).toBe('OTP_EXPIRED');
  });

  it('a known number logs straight in (same account, new token)', async () => {
    const h = await makeHarness();
    const r = await h.cmd.requestOtp({ phone: '+962790000001' });   // Laith's seeded number
    const v = await h.cmd.verifyOtp({ phone: '+962790000001', code: r.demoCode });
    expect('token' in v && rider(v.view).me.firstName).toBe('Laith');
  });

  it('wrong code, too many tries, expiry, resend too soon, bad number', async () => {
    const h = await makeHarness();
    expect(await code(h.cmd.requestOtp({ phone: '0612345' }))).toBe('BAD_PHONE');
    const r = await h.cmd.requestOtp({ phone: '0795550102' });
    expect(await code(h.cmd.requestOtp({ phone: '0795550102' }))).toBe('OTP_WAIT');
    const wrong = r.demoCode === '000000' ? '111111' : '000000';
    for (let i = 0; i < 4; i++) expect(await code(h.cmd.verifyOtp({ phone: '0795550102', code: wrong }))).toBe('OTP_WRONG');
    expect(await code(h.cmd.verifyOtp({ phone: '0795550102', code: wrong }))).toBe('OTP_EXPIRED');   // 5th wrong try burns the code
    expect(await code(h.cmd.verifyOtp({ phone: '0795550102', code: r.demoCode }))).toBe('OTP_EXPIRED');
    h.real.ms += 31_000;
    const r2 = await h.cmd.requestOtp({ phone: '0795550102' });
    h.real.ms += 301_000;
    expect(await code(h.cmd.verifyOtp({ phone: '0795550102', code: r2.demoCode }))).toBe('OTP_EXPIRED');
  });

  it('sign-up without a verified phone is refused', async () => {
    const h = await makeHarness();
    expect(await code(h.cmd.signup({ firstName: 'Maya', lastName: 'Khoury', gender: 'F', role: 'rider', ticket: 'made-up-ticket-1234' }))).toBe('OTP_EXPIRED');
  });
});

describe('profile and log out', () => {
  it('edit first name and the same-gender default; gender stays fixed; log out kills the token', async () => {
    const h = await makeHarness();
    const laith = await h.login('laith');
    const v = rider(await h.cmd.updateProfile(laith, { firstName: '  Leena ', sameGenderOnly: false }));
    expect([v.me.firstName, v.me.sameGenderOnly, v.me.gender]).toEqual(['Leena', false, 'M']);
    await h.cmd.logout(laith);
    expect(await code(h.cmd.me(laith))).toBe('LOGGED_OUT');
  });
});

describe('calling: only a rider and their assigned driver see each other\'s number', () => {
  it('no numbers before accept or between riders; after accept the driver sees each rider\'s, the rider sees the driver\'s', async () => {
    const h = await makeHarness();
    const laith = await h.login('laith'), saed = await h.login('saed'), yazeed = await h.login('yazeed');
    const rideId = rider(await h.cmd.createRide(laith, trip('CC'))).ride!.id;
    await h.cmd.join(saed, rideId, trip('US'));
    await h.cmd.findDriver(laith, rideId);
    await h.cmd.ready(laith, rideId, { answer: 'READY' }); await h.cmd.ready(saed, rideId, { answer: 'READY' });
    const offer = driver(await h.cmd.me(yazeed)).offers[0]!;
    expect(offer.stops.some((s) => s.phone)).toBe(false);
    expect(JSON.stringify(await h.cmd.me(saed))).not.toContain('+962790000001');   // Laith's number never reaches Saed
    await h.cmd.accept(yazeed, rideId);
    const stops = driver(await h.cmd.me(yazeed)).trip!.stops.filter((s) => s.kind === 'P');
    expect(Object.fromEntries(stops.map((s) => [s.firstName, s.phone]))).toEqual({ Laith: '+962790000001', Saed: '+962790000002' });
    expect(rider(await h.cmd.me(saed)).ride!.driver!.phone).toBe('+962790000009');
    expect(JSON.stringify(await h.cmd.me(saed))).not.toContain('+962790000001');
  });
});

describe('full name (owner request): my own screens show it, others still see only my first name', () => {
  it('sign-up takes a last name; profile can edit it; riders in my ride never get it', async () => {
    const h = await makeHarness();
    const r = await h.cmd.requestOtp({ phone: '0795550144' });
    const v = await h.cmd.verifyOtp({ phone: '0795550144', code: r.demoCode }) as { ticket: string };
    const s = rider((await h.cmd.signup({ firstName: 'Karim', lastName: ' Khoury ', gender: 'M', role: 'rider', ticket: v.ticket })).view);
    expect([s.me.firstName, s.me.lastName]).toEqual(['Karim', 'Khoury']);
    const karim = (await h.store.withLock(async (repo) => (await repo.listUsers()).find((u) => u.firstName === 'Karim')))!.token;
    expect(rider(await h.cmd.updateProfile(karim, { lastName: 'Nasser' })).me.lastName).toBe('Nasser');
    const laith = await h.login('laith');
    expect(rider(await h.cmd.me(laith)).me.lastName).toBe('Na\'amneh');   // seeded
    const rideId = rider(await h.cmd.createRide(laith, trip('CC'))).ride!.id;
    await h.cmd.join(karim, rideId, trip('US'));
    expect(JSON.stringify(await h.cmd.me(laith))).not.toContain('Nasser');   // Karim's last name never reaches Laith
    expect(JSON.stringify(await h.cmd.me(karim)).match(/Na'amneh/g)).toBeNull();   // nor Laith's reaches Karim
  });
});

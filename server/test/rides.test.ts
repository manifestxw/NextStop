// Ride state machine, money flow, races and rules at the command level (SPEC §3.3–§3.13).
import { describe, expect, it } from 'vitest';
import { makeHarness, trip, rider, driver, hhmm } from './helpers.js';
import { ConflictError } from '../src/domain/errors.js';

const code = async (p: Promise<unknown>) => {
  try { await p; return 'ok'; } catch (e) { if (e instanceof ConflictError) return e.code; throw e; }
};

async function linaRide() {
  const h = await makeHarness();
  const laith = await h.login('laith'), saed = await h.login('saed');
  const v = rider(await h.cmd.createRide(laith, trip('CC')));
  return { ...h, laith, saed, rideId: v.ride!.id };
}

describe('create', () => {
  it('Laith creates: solo price, ready-by 7:15, zone 1.5 km, chat open', async () => {
    const { cmd, laith } = await linaRide();
    const r = rider(await cmd.me(laith)).ride!;
    expect([r.state, r.isHost, r.shareJod, r.soloJod, hhmm(r.beReadyBy), r.zoneKm, r.seats.length, r.seatsLeft])
      .toEqual(['OPEN', true, 7.85, 7.85, '07:15', { pickup: 1.5, dest: 1.0 }, 1, 3]);
  });

  it('refuses a first pickup under 60 min away (TOO_SOON) and a second overlapping ride (rule 12)', async () => {
    const h = await makeHarness();
    const laith = await h.login('laith');
    expect(await code(h.cmd.createRide(laith, trip('CC', '2026-11-29T07:00:00+03:00')))).toBe('TOO_SOON');
    await h.cmd.createRide(laith, trip('CC'));
    expect(await code(h.cmd.createRide(laith, trip('US', '2026-11-29T08:30:00+03:00')))).toBe('ALREADY_IN_RIDE');
  });

  it('quote: Economy from 2.35, estimates, Airport unavailable without the airport', async () => {
    const h = await makeHarness();
    const q = await h.cmd.quote(await h.login('laith'), { pickup: { key: 'CC' }, dest: { key: 'JUST' }, arriveBy: '2026-11-29T08:00:00+03:00' });
    const eco = q.categories.find((c) => c.category === 'economy')!;
    expect([eco.soloJod, eco.fromJod, eco.estimates.map((e) => e.eachJod), hhmm(eco.beReadyBy), eco.uniTrip]).toEqual([7.85, 2.35, [7.85, 4.15, 2.95, 2.35], '07:15', true]);
    expect(q.categories.find((c) => c.category === 'airport')!.available).toBe(false);
    expect([q.pickup.area, q.dest.name]).toEqual(['City Center area', 'Jordan University of Science and Technology']);
  });
});

describe('search and join', () => {
  it('Saed sees area names only and the real share, joins instantly; Laith gets a live push', async () => {
    const { cmd, saed, rideId, pushed } = await linaRide();
    const cards = await cmd.search(saed, trip('US'));
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ rideId, hostFirstName: 'Laith', pickupArea: 'City Center area', destArea: 'JUST', eachJod: 4.0, seatsLeft: 3 });
    expect(hhmm(cards[0]!.myPickupAt)).toBe('07:21');
    expect(JSON.stringify(cards)).not.toMatch(/Irbid City Center|32\.5568/);
    const before = pushed.length;
    const v = rider(await cmd.join(saed, rideId, trip('US')));
    expect([v.ride!.seats.length, v.ride!.shareJod, hhmm(v.ride!.beReadyBy)]).toEqual([2, 4.0, '07:21']);
    expect(JSON.stringify(v)).not.toMatch(/Irbid City Center|32\.5568|35\.8469/);   // never Laith's address or coordinates
    const linaPush = pushed.slice(before).find((p) => p.userId === 'u-laith');
    expect(rider(linaPush!.view).ride).toMatchObject({ shareJod: 4.0 });
    expect(rider(linaPush!.view).ride!.chat.group.map((m) => m.text)).toContain('Saed joined');
  });

  it('a man never sees a women-only ride', async () => {
    const { cmd, ctx } = await linaRide();
    const rasha = await ctx.store.withLock(async (r) => (await r.getUser('u-rasha'))!.token);
    expect(await cmd.search(rasha, trip('US', undefined, { sameGenderOnly: false }))).toEqual([]);
  });

  it('two riders racing for the last seat: exactly one gets it', async () => {
    const { cmd, saed, rideId, ctx } = await linaRide();
    await cmd.join(saed, rideId, trip('US'));
    await cmd.demo.simulateRider(rideId);                          // Deya\'a → 3 of 4
    const tok = (id: string) => ctx.store.withLock(async (r) => (await r.getUser(id))!.token);
    const [adnan, noor] = [await tok('u-adnan'), await tok('u-noor')];
    const results = await Promise.all([code(cmd.join(adnan, rideId, trip('YU'))), code(cmd.join(noor, rideId, trip('AM')))]);
    expect(results.sort()).toEqual(['RIDE_FULL', 'ok']);
  });

  it('joining after the ready check started: RIDE_CLOSED', async () => {
    const { cmd, laith, saed, rideId } = await linaRide();
    await cmd.findDriver(laith, rideId);
    expect(await code(cmd.join(saed, rideId, trip('US')))).toBe('RIDE_CLOSED');
  });
});

describe('leaving', () => {
  it('host leaves while OPEN: host, anchor and button pass to Saed; shares recompute', async () => {
    const { cmd, laith, saed, rideId } = await linaRide();
    await cmd.join(saed, rideId, trip('US'));
    await cmd.leave(laith, rideId, {});
    const r = rider(await cmd.me(saed)).ride!;
    expect([r.isHost, r.seats.length, r.shareJod]).toEqual([true, 1, 6.9]);
    expect(rider(await cmd.me(laith)).ride).toBeUndefined();
  });

  it('last rider leaves: the ride is canceled', async () => {
    const { cmd, laith, rideId, ctx } = await linaRide();
    await cmd.leave(laith, rideId, {});
    expect((await ctx.store.withLock((r) => r.getRide(rideId)))!.state).toBe('CANCELED');
  });
});

describe('ready check and dispatch', () => {
  it('no answers within 5 min count as ready → dispatched; a cancel is a free leave', async () => {
    const { cmd, laith, saed, rideId, ctx } = await linaRide();
    await cmd.join(saed, rideId, trip('US'));
    await cmd.findDriver(laith, rideId);
    await cmd.ready(saed, rideId, { answer: 'CANCEL' });
    await cmd.demo.clock({ advanceMin: 5 });
    const ride = (await ctx.store.withLock((r) => r.getRide(rideId)))!;
    expect([ride.state, ride.members.find((m) => m.userId === 'u-saed')!.state, ride.members[0]!.readyAnswer]).toEqual(['DISPATCHED', 'LEFT', 'READY']);
  });

  it('everyone cancels in the ready check: canceled, no fees', async () => {
    const { cmd, laith, rideId, ctx } = await linaRide();
    await cmd.findDriver(laith, rideId);
    await cmd.ready(laith, rideId, { answer: 'CANCEL' });
    expect((await ctx.store.withLock((r) => r.getRide(rideId)))!.state).toBe('CANCELED');
  });

  it('starts automatically at first pickup − 45 (stepped fast-forward), and expires without a driver', async () => {
    const { cmd, rideId, ctx } = await linaRide();          // first pickup 7:15 → auto at 6:30
    await cmd.demo.clock({ advanceMin: 21 });               // 6:31
    let ride = (await ctx.store.withLock((r) => r.getRide(rideId)))!;
    expect([ride.state, ride.readyCheck?.startedBy, hhmm(ride.readyCheck!.startedAt)]).toEqual(['READY_CHECK', 'auto', '06:30']);
    await cmd.demo.clock({ advanceMin: 40 });               // past 6:35 dispatch and 7:00 expiry
    ride = (await ctx.store.withLock((r) => r.getRide(rideId)))!;
    expect(ride.state).toBe('CANCELED');
  });

  it('a driver who rejects never sees the offer again', async () => {
    const { cmd, laith, rideId, login } = await linaRide();
    await cmd.findDriver(laith, rideId);
    await cmd.ready(laith, rideId, { answer: 'READY' });
    const yazeed = await login('yazeed');
    expect(driver(await cmd.me(yazeed)).offers).toHaveLength(1);
    expect(driver(await cmd.reject(yazeed, rideId)).offers).toHaveLength(0);
    expect(await code(cmd.accept(yazeed, rideId))).toBe('OFFER_TAKEN');
  });
});

describe('late leave money (SPEC §3.10)', () => {
  it('a late leave is charged, and reversed if the ride is later canceled', async () => {
    const { cmd, laith, saed, rideId, login, ctx } = await linaRide();
    await cmd.join(saed, rideId, trip('US'));
    await cmd.findDriver(laith, rideId);
    await cmd.ready(laith, rideId, { answer: 'READY' });
    await cmd.ready(saed, rideId, { answer: 'READY' });
    await cmd.accept(await login('yazeed'), rideId);
    await cmd.demo.clock({ jumpTo: '2026-11-29T06:55:00+03:00' });   // first pickup 7:12 → 17 min
    expect(await code(cmd.leave(saed, rideId, {}))).toBe('LATE_CONFIRM_REQUIRED');
    await cmd.leave(saed, rideId, { acceptCharge: true });
    expect((await ctx.store.withLock((r) => r.getUser('u-saed')))!.outstandingP).toBe(400);
    await cmd.leave(laith, rideId, { acceptCharge: true });            // last rider → canceled
    expect((await ctx.store.withLock((r) => r.getRide(rideId)))!.state).toBe('CANCELED');
    expect((await ctx.store.withLock((r) => r.getUser('u-saed')))!.outstandingP).toBe(0);
  });
});

describe('auth', () => {
  it('a reset logs every phone out (old epoch → LOGGED_OUT)', async () => {
    const { cmd, laith } = await linaRide();
    await cmd.demo.reset();
    await expect(cmd.me(laith)).rejects.toMatchObject({ name: 'LoggedOutError' });
  });
});

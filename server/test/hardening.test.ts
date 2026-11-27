// T19 (SPEC §3.3, §3.6, §3.8, §3.10): driver stop taps, no-show, driver cancel, pickup-time banners.
import { describe, expect, it } from 'vitest';
import { makeHarness, trip, rider, driver } from './helpers.js';
import { ConflictError } from '../src/domain/errors.js';

const code = async (p: Promise<unknown>) => {
  try { await p; return 'ok'; } catch (e) { if (e instanceof ConflictError) return e.code; throw e; }
};

/** Lina + Sara, ready check done, Omar accepted. First pickup 7:12 (fixed table). */
async function accepted() {
  const h = await makeHarness();
  const lina = await h.login('lina'), sara = await h.login('sara'), omar = await h.login('omar');
  const rideId = rider(await h.cmd.createRide(lina, trip('CC'))).ride!.id;
  await h.cmd.join(sara, rideId, trip('US'));
  await h.cmd.findDriver(lina, rideId);
  await h.cmd.ready(lina, rideId, { answer: 'READY' });
  await h.cmd.ready(sara, rideId, { answer: 'READY' });
  await h.cmd.accept(omar, rideId);
  const ride = async () => (await h.store.withLock((r) => r.getRide(rideId)))!;
  return { ...h, lina, sara, omar, rideId, ride };
}

describe('driver stop taps (P1)', () => {
  it('first pickup → IN_PROGRESS; last drop-off → COMPLETED with credits paid and summaries', async () => {
    const { cmd, omar, rideId, ride, store } = await accepted();
    await cmd.stop(omar, rideId, 'P-u-lina', 'picked-up');
    expect((await ride()).state).toBe('IN_PROGRESS');
    expect(await code(cmd.stop(omar, rideId, 'D-u-sara', 'dropped-off'))).toBe('ILLEGAL_STATE');   // not picked up yet
    await cmd.stop(omar, rideId, 'P-u-sara', 'picked-up');
    await cmd.stop(omar, rideId, 'D-u-lina', 'dropped-off');
    expect((await ride()).state).toBe('IN_PROGRESS');
    await cmd.stop(omar, rideId, 'D-u-sara', 'dropped-off');
    const r = await ride();
    expect([r.state, r.members.map((m) => m.state)]).toEqual(['COMPLETED', ['DROPPED_OFF', 'DROPPED_OFF']]);
    const s = driver(await cmd.me(omar)).trip!.summary!;
    expect([s.riders.map((x) => x.cashJod), s.totalJod]).toEqual([[4, 4], 8]);
    expect((await store.withLock((x) => x.getDriver('u-omar')))!.creditBalanceP).toBe(0);
  });

  it('only the assigned driver can tap stops', async () => {
    const { cmd, lina, rideId } = await accepted();
    await expect(cmd.stop(lina, rideId, 'P-u-lina', 'picked-up')).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('no-show (P1)', () => {
  it('only 5 min after the shown pickup; then charged like a late leave and the trip continues', async () => {
    const { cmd, omar, rideId, ride, store } = await accepted();
    await cmd.demo.clock({ jumpTo: '2026-11-29T07:16:00+03:00' });            // Sara shown 7:21
    expect(await code(cmd.stop(omar, rideId, 'P-u-sara', 'no-show'))).toBe('ILLEGAL_STATE');
    await cmd.stop(omar, rideId, 'P-u-lina', 'picked-up');
    await cmd.demo.clock({ jumpTo: '2026-11-29T07:26:00+03:00' });
    await cmd.stop(omar, rideId, 'P-u-sara', 'no-show');
    const r = await ride();
    expect([r.state, r.members.find((m) => m.userId === 'u-sara')!.state, r.creditsP]).toEqual(['IN_PROGRESS', 'NO_SHOW', 400]);
    expect((await store.withLock((x) => x.getUser('u-sara')))!.outstandingP).toBe(400);
    expect(r.plan.shareP).toBeLessThanOrEqual(400);
    expect(r.plan.stops.some((s) => s.userId === 'u-sara')).toBe(false);
    expect(r.members.find((m) => m.userId === 'u-lina')!.shownPickup).toMatch(/T07:12/);   // others' times unchanged
  });
});

describe('driver cancel (P1)', () => {
  it('≥ 15 min before the first pickup: back to finding a driver, this driver never sees it again', async () => {
    const { cmd, omar, rideId, ride } = await accepted();
    await cmd.driverCancel(omar, rideId);
    const r = await ride();
    expect([r.state, r.driverUserId, r.dispatch!.offeredTo]).toEqual(['DISPATCHED', undefined, []]);
    expect(driver(await cmd.me(omar)).offers).toEqual([]);
  });

  it('< 15 min before: canceled, late charges reversed, riders told why', async () => {
    const { cmd, omar, sara, lina, rideId, ride, store } = await accepted();
    await cmd.demo.clock({ jumpTo: '2026-11-29T06:55:00+03:00' });
    await cmd.leave(sara, rideId, { acceptCharge: true });                    // late: charged 4.00
    await cmd.demo.clock({ jumpTo: '2026-11-29T07:00:00+03:00' });
    await cmd.driverCancel(omar, rideId);
    expect((await ride()).state).toBe('CANCELED');
    expect((await store.withLock((x) => x.getUser('u-sara')))!.outstandingP).toBe(0);
    const v = rider(await cmd.me(lina));
    expect([v.ride!.state, v.ride!.cancelReason]).toEqual(['CANCELED', 'driver-canceled']);
  });

  it('no driver by first pickup − 15: canceled with reason no-driver', async () => {
    const h = await makeHarness();
    const lina = await h.login('lina');
    const id = rider(await h.cmd.createRide(lina, trip('CC'))).ride!.id;
    await h.cmd.findDriver(lina, id);
    await h.cmd.ready(lina, id, { answer: 'READY' });
    await h.cmd.demo.clock({ jumpTo: '2026-11-29T07:05:00+03:00' });
    expect(rider(await h.cmd.me(lina)).ride!.cancelReason).toBe('no-driver');
  });
});

describe('pickup-time banners (P1, SPEC §3.6)', () => {
  it('a rider whose pickup moves more than 3 min before the ready check gets a banner; the chat says times changed', async () => {
    const h = await makeHarness();
    const lina = await h.login('lina'), sara = await h.login('sara');
    const id = rider(await h.cmd.createRide(lina, trip('CC'))).ride!.id;     // Lina 7:15
    await h.cmd.join(sara, id, trip('US'));                                  // Lina 7:12 (3 min: no banner)
    expect(rider(await h.cmd.me(lina)).banners).toEqual([]);
    const rania = await h.store.withLock(async (r) => (await r.getUser('u-rania'))!.token);
    await h.cmd.join(rania, id, trip('HS', '2026-11-29T08:05:00+03:00'));    // Lina 7:05 (7 min)
    const v = rider(await h.cmd.me(lina));
    expect(v.banners.map((b) => b.text)).toEqual(['Your pickup moved to 7:05 AM']);
    expect(v.ride!.chat.group.map((m) => m.text)).toContain('Pickup times changed');
  });
});

describe('in the car (owner fix)', () => {
  it('a picked-up rider is told so, cannot leave, and cannot remove their +1; others still can leave', async () => {
    const { cmd, omar, lina, sara, rideId } = await accepted();
    await cmd.stop(omar, rideId, 'P-u-lina', 'picked-up');
    const v = rider(await cmd.me(lina)).ride!;
    expect([v.onBoard, v.leave.canLeave]).toEqual([true, false]);
    expect(rider(await cmd.me(sara)).ride!.onBoard).toBeUndefined();
    expect(await code(cmd.leave(lina, rideId, { acceptCharge: true }))).toBe('ILLEGAL_STATE');
    expect(await code(cmd.removeGuest(lina, rideId, { acceptCharge: true }))).toBe('ILLEGAL_STATE');
    expect(rider(await cmd.me(sara)).ride!.leave.canLeave).toBe(true);
  });
});

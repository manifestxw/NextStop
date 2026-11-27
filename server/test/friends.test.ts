// T17 (SPEC §3.17): +1 seats and friend-code invites.
import { describe, expect, it } from 'vitest';
import { makeHarness, trip, rider } from './helpers.js';
import { ConflictError } from '../src/domain/errors.js';

const code = async (p: Promise<unknown>) => {
  try { await p; return 'ok'; } catch (e) { if (e instanceof ConflictError) return e.code; throw e; }
};

async function linaSara() {
  const h = await makeHarness();
  const laith = await h.login('laith'), saed = await h.login('saed');
  const rideId = rider(await h.cmd.createRide(laith, trip('CC'))).ride!.id;
  await h.cmd.join(saed, rideId, trip('US'));
  const tok = (id: string) => h.store.withLock(async (r) => (await r.getUser(id))!.token);
  return { ...h, laith, saed, rideId, tok };
}

describe('+1 (SPEC §3.17 A)', () => {
  it('adds a seat, keeps the fare and stops, lowers every share (7.95 / 2 → / 3)', async () => {
    const { cmd, saed, laith, rideId } = await linaSara();
    const v = rider(await cmd.addGuest(saed, rideId, { firstName: 'Karim', gender: 'M' })).ride!;
    expect([v.seats.map((s) => s.firstName), v.seatsLeft, v.shareJod, v.myCashDueJod, v.myGuest]).toEqual([['Laith', 'Saed', 'Karim'], 1, 2.65, 5.3, { firstName: 'Karim' }]);
    expect(rider(await cmd.me(laith)).ride!.chat.group.map((m) => m.text)).toContain('Saed added a friend (Karim)');
  });

  it('refuses a +1 of another gender on a same-gender ride, a second +1, and a full car', async () => {
    const { cmd, saed, laith, rideId, tok } = await linaSara();
    expect(await code(cmd.addGuest(saed, rideId, { firstName: 'Lama', gender: 'F' }))).toBe('NOT_ELIGIBLE');
    await cmd.addGuest(saed, rideId, { firstName: 'Karim', gender: 'M' });
    expect(await code(cmd.addGuest(saed, rideId, { firstName: 'Fadi', gender: 'M' }))).toBe('NOT_ELIGIBLE');
    await cmd.addGuest(laith, rideId, { firstName: 'Ziad', gender: 'M' });     // 4 of 4
    expect(await code(cmd.join(await tok('u-deyaa'), rideId, trip('HS', '2026-11-29T08:05:00+03:00')))).toBe('RIDE_FULL');
  });

  it('removing a +1 while OPEN is free; after the freeze a late removal charges the bringer', async () => {
    const { cmd, saed, laith, rideId, store, login } = await linaSara();
    await cmd.addGuest(saed, rideId, { firstName: 'Karim', gender: 'M' });
    await cmd.removeGuest(saed, rideId, {});
    expect(rider(await cmd.me(saed)).ride!.shareJod).toBe(4.0);
    await cmd.addGuest(saed, rideId, { firstName: 'Karim', gender: 'M' });
    await cmd.findDriver(laith, rideId);
    await cmd.ready(laith, rideId, { answer: 'READY' });
    await cmd.ready(saed, rideId, { answer: 'READY' });
    await cmd.accept(await login('yazeed'), rideId);
    await cmd.demo.clock({ jumpTo: '2026-11-29T06:55:00+03:00' });              // first pickup 7:12
    expect(await code(cmd.removeGuest(saed, rideId, {}))).toBe('LATE_CONFIRM_REQUIRED');
    await cmd.removeGuest(saed, rideId, { acceptCharge: true });
    const r = (await store.withLock((x) => x.getRide(rideId)))!;
    expect([r.creditsP, r.plan.shareP <= 265, (await store.withLock((x) => x.getUser('u-saed')))!.outstandingP]).toEqual([265, true, 265]);
  });

  it('a rider leaving with a +1 takes both seats', async () => {
    const { cmd, saed, laith, rideId } = await linaSara();
    await cmd.addGuest(saed, rideId, { firstName: 'Karim', gender: 'M' });
    await cmd.leave(saed, rideId, {});
    expect(rider(await cmd.me(laith)).ride!.seats.map((s) => s.firstName)).toEqual(['Laith']);
  });
});

describe('friend-code invites (SPEC §3.17 B)', () => {
  it('invites by code; the friend joins with their own pickup under every rule; the invite is used', async () => {
    const { cmd, laith, rideId, tok } = await linaSara();
    expect(await code(cmd.invite(laith, rideId, { friendCode: 'NOPE00' }))).toBe('NO_SUCH_CODE');
    const v = rider(await cmd.invite(laith, rideId, { friendCode: 'noor26' })).ride!;
    expect(v.sentInvites).toEqual([expect.objectContaining({ firstName: 'Noor', state: 'waiting' })]);
    const noor = await tok('u-noor');
    const inv = rider(await cmd.me(noor)).invites;
    expect(inv).toEqual([expect.objectContaining({ rideId, fromFirstName: 'Laith', destArea: 'JUST', destKey: 'JUST', category: 'economy' })]);
    expect(rider(await cmd.me(noor)).banners.map((b) => b.text)).toContain('Laith invited you to a ride to JUST');
    await cmd.join(noor, rideId, { ...trip('AM'), inviteId: inv[0]!.id });
    const after = rider(await cmd.me(noor));
    expect([after.ride!.id, after.invites]).toEqual([rideId, []]);
    expect(after.ride!.chat.group.map((m) => m.text)).toContain('Noor joined (invited by Laith)');
  });

  it('a declined invite disappears; an invite expires when the ready check starts', async () => {
    const { cmd, laith, rideId, tok } = await linaSara();
    await cmd.invite(laith, rideId, { friendCode: 'NOOR26' });
    const noor = await tok('u-noor');
    await cmd.declineInvite(noor, rider(await cmd.me(noor)).invites[0]!.id);
    expect(rider(await cmd.me(noor)).invites).toEqual([]);
    await cmd.invite(laith, rideId, { friendCode: 'NOOR26' });
    await cmd.findDriver(laith, rideId);
    expect(rider(await cmd.me(noor)).invites).toEqual([]);
  });
});

describe('invites, complete (P1)', () => {
  it('the friend sees who, how full, and their price before joining; accepts with a pinned pickup; the inviter sees "joined"', async () => {
    const { cmd, laith, rideId, tok } = await linaSara();
    await cmd.invite(laith, rideId, { friendCode: 'NOOR26' });
    const noor = await tok('u-noor');
    const inv = rider(await cmd.me(noor)).invites[0]!;
    expect([inv.hostFirstName, inv.riders, inv.seatsLeft, inv.pickupArea]).toEqual(['Laith', 2, 2, 'City Center area']);
    const pin = await cmd.placeAt(noor, 32.5375, 35.8573);   // a pin a few metres from Arabella Mall
    const pv = await cmd.previewInvite(noor, inv.id, { pickup: { placeId: pin.placeId, name: pin.name, lat: pin.lat, lng: pin.lng }, sameGenderOnly: true });
    expect([pv.eachJod < 3.1, pv.riders, typeof pv.myPickupAt]).toEqual([true, 3, 'string']);
    expect(await code(cmd.previewInvite(noor, inv.id, { pickup: { key: 'QAIA' }, sameGenderOnly: true }))).toBe('NOT_ELIGIBLE');
    const v = rider(await cmd.acceptInvite(noor, inv.id, { pickup: { placeId: pin.placeId, name: pin.name, lat: pin.lat, lng: pin.lng }, sameGenderOnly: true }));
    expect([v.ride!.id, v.ride!.shareJod, v.ride!.myDest.area]).toEqual([rideId, pv.eachJod, 'JUST']);
    expect(rider(await cmd.me(laith)).ride!.sentInvites).toEqual([expect.objectContaining({ firstName: 'Noor', state: 'joined' })]);
  });

  it('the inviter sees declined and expired; a declined friend can be invited again', async () => {
    const { cmd, laith, rideId, tok } = await linaSara();
    await cmd.invite(laith, rideId, { friendCode: 'NOOR26' });
    const noor = await tok('u-noor');
    await cmd.declineInvite(noor, rider(await cmd.me(noor)).invites[0]!.id);
    expect(rider(await cmd.me(laith)).ride!.sentInvites!.map((i) => i.state)).toEqual(['declined']);
    await cmd.invite(laith, rideId, { friendCode: 'NOOR26' });
    expect(rider(await cmd.me(laith)).ride!.sentInvites!.map((i) => i.state)).toEqual(['waiting']);
    await cmd.findDriver(laith, rideId);
    expect(rider(await cmd.me(laith)).ride!.sentInvites!.map((i) => i.state)).toEqual(['expired']);
  });

  it('refuses a friend who could never join: other gender on a same-gender ride, or a full car', async () => {
    const { cmd, laith, rideId } = await linaSara();
    expect(await code(cmd.invite(laith, rideId, { friendCode: 'RASH26' }))).toBe('NOT_ELIGIBLE');
    await cmd.demo.simulateRider(rideId); await cmd.demo.simulateRider(rideId);
    expect(await code(cmd.invite(laith, rideId, { friendCode: 'NOOR26' }))).toBe('RIDE_FULL');
  });

  it('a friend code can be checked before inviting (name only); a friend sees every invite', async () => {
    const h = await makeHarness();
    const laith = await h.login('laith'), saed = await h.login('saed');
    expect(await h.cmd.lookupCode(laith, 'noor26')).toEqual({ firstName: 'Noor' });
    expect(await code(h.cmd.lookupCode(laith, 'YAZE26'))).toBe('NO_SUCH_CODE');
    expect(await code(h.cmd.lookupCode(laith, 'LAIT26'))).toBe('NOT_ELIGIBLE');
    const r1 = rider(await h.cmd.createRide(laith, trip('CC'))).ride!.id;
    const r2 = rider(await h.cmd.createRide(saed, trip('US', '2026-11-29T08:30:00+03:00'))).ride!.id;
    await h.cmd.invite(laith, r1, { friendCode: 'NOOR26' });
    await h.cmd.invite(saed, r2, { friendCode: 'NOOR26' });
    const noor = await h.store.withLock(async (r) => (await r.getUser('u-noor'))!.token);
    expect(rider(await h.cmd.me(noor)).invites.map((i) => i.fromFirstName).sort()).toEqual(['Laith', 'Saed']);
  });
});

// T17 (SPEC §3.17): +1 seats and friend-code invites.
import { describe, expect, it } from 'vitest';
import { makeHarness, trip, rider } from './helpers.js';
import { ConflictError } from '../src/domain/errors.js';

const code = async (p: Promise<unknown>) => {
  try { await p; return 'ok'; } catch (e) { if (e instanceof ConflictError) return e.code; throw e; }
};

async function linaSara() {
  const h = await makeHarness();
  const lina = await h.login('lina'), sara = await h.login('sara');
  const rideId = rider(await h.cmd.createRide(lina, trip('CC'))).ride!.id;
  await h.cmd.join(sara, rideId, trip('US'));
  const tok = (id: string) => h.store.withLock(async (r) => (await r.getUser(id))!.token);
  return { ...h, lina, sara, rideId, tok };
}

describe('+1 (SPEC §3.17 A)', () => {
  it('adds a seat, keeps the fare and stops, lowers every share (7.95 / 2 → / 3)', async () => {
    const { cmd, sara, lina, rideId } = await linaSara();
    const v = rider(await cmd.addGuest(sara, rideId, { firstName: 'Maya', gender: 'F' })).ride!;
    expect([v.seats.map((s) => s.firstName), v.seatsLeft, v.shareJod, v.myCashDueJod, v.myGuest]).toEqual([['Lina', 'Sara', 'Maya'], 1, 2.65, 5.3, { firstName: 'Maya' }]);
    expect(rider(await cmd.me(lina)).ride!.chat.group.map((m) => m.text)).toContain('Sara added a friend (Maya)');
  });

  it('refuses a +1 of another gender on a same-gender ride, a second +1, and a full car', async () => {
    const { cmd, sara, lina, rideId, tok } = await linaSara();
    expect(await code(cmd.addGuest(sara, rideId, { firstName: 'Ali', gender: 'M' }))).toBe('NOT_ELIGIBLE');
    await cmd.addGuest(sara, rideId, { firstName: 'Maya', gender: 'F' });
    expect(await code(cmd.addGuest(sara, rideId, { firstName: 'Huda', gender: 'F' }))).toBe('NOT_ELIGIBLE');
    await cmd.addGuest(lina, rideId, { firstName: 'Reem', gender: 'F' });     // 4 of 4
    expect(await code(cmd.join(await tok('u-rania'), rideId, trip('HS', '2026-11-29T08:05:00+03:00')))).toBe('RIDE_FULL');
  });

  it('removing a +1 while OPEN is free; after the freeze a late removal charges the bringer', async () => {
    const { cmd, sara, lina, rideId, store, login } = await linaSara();
    await cmd.addGuest(sara, rideId, { firstName: 'Maya', gender: 'F' });
    await cmd.removeGuest(sara, rideId, {});
    expect(rider(await cmd.me(sara)).ride!.shareJod).toBe(4.0);
    await cmd.addGuest(sara, rideId, { firstName: 'Maya', gender: 'F' });
    await cmd.findDriver(lina, rideId);
    await cmd.ready(lina, rideId, { answer: 'READY' });
    await cmd.ready(sara, rideId, { answer: 'READY' });
    await cmd.accept(await login('omar'), rideId);
    await cmd.demo.clock({ jumpTo: '2026-11-29T06:55:00+03:00' });              // first pickup 7:12
    expect(await code(cmd.removeGuest(sara, rideId, {}))).toBe('LATE_CONFIRM_REQUIRED');
    await cmd.removeGuest(sara, rideId, { acceptCharge: true });
    const r = (await store.withLock((x) => x.getRide(rideId)))!;
    expect([r.creditsP, r.plan.shareP <= 265, (await store.withLock((x) => x.getUser('u-sara')))!.outstandingP]).toEqual([265, true, 265]);
  });

  it('a rider leaving with a +1 takes both seats', async () => {
    const { cmd, sara, lina, rideId } = await linaSara();
    await cmd.addGuest(sara, rideId, { firstName: 'Maya', gender: 'F' });
    await cmd.leave(sara, rideId, {});
    expect(rider(await cmd.me(lina)).ride!.seats.map((s) => s.firstName)).toEqual(['Lina']);
  });
});

describe('friend-code invites (SPEC §3.17 B)', () => {
  it('invites by code; the friend joins with their own pickup under every rule; the invite is used', async () => {
    const { cmd, lina, rideId, tok } = await linaSara();
    expect(await code(cmd.invite(lina, rideId, { friendCode: 'NOPE00' }))).toBe('NO_SUCH_CODE');
    const v = rider(await cmd.invite(lina, rideId, { friendCode: 'noor26' })).ride!;
    expect(v.pendingInvites).toEqual([{ firstName: 'Noor' }]);
    const noor = await tok('u-noor');
    const inv = rider(await cmd.me(noor)).invites;
    expect(inv).toEqual([expect.objectContaining({ rideId, fromFirstName: 'Lina', destArea: 'JUST', destKey: 'JUST', category: 'economy' })]);
    expect(rider(await cmd.me(noor)).banners.map((b) => b.text)).toContain('Lina invited you to a ride to JUST');
    await cmd.join(noor, rideId, { ...trip('AM'), inviteId: inv[0]!.id });
    const after = rider(await cmd.me(noor));
    expect([after.ride!.id, after.invites]).toEqual([rideId, []]);
    expect(after.ride!.chat.group.map((m) => m.text)).toContain('Noor joined (invited by Lina)');
  });

  it('a declined invite disappears; an invite expires when the ready check starts', async () => {
    const { cmd, lina, rideId, tok } = await linaSara();
    await cmd.invite(lina, rideId, { friendCode: 'NOOR26' });
    const noor = await tok('u-noor');
    await cmd.declineInvite(noor, rider(await cmd.me(noor)).invites[0]!.id);
    expect(rider(await cmd.me(noor)).invites).toEqual([]);
    await cmd.invite(lina, rideId, { friendCode: 'NOOR26' });
    await cmd.findDriver(lina, rideId);
    expect(rider(await cmd.me(noor)).invites).toEqual([]);
  });
});

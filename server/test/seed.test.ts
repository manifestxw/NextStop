import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '../src/store/memoryRepo.js';
import { loadSeed, seedIfEmpty, resetToSeed, SIM_ORDER } from '../src/store/seed.js';
import { parseConfig } from '../src/config.js';

const cfg = parseConfig({});

describe('seed (SPEC §2.6)', () => {
  it('has the 7 places (6 Irbid + the airport) with area names, the demo accounts and Yazeed', () => {
    const s = loadSeed();
    expect(s.places.map((p) => p.key)).toEqual(['CC', 'HS', 'US', 'YU', 'AM', 'JUST', 'QAIA']);
    expect(s.places.find((p) => p.key === 'CC')?.area).toBe('City Center area');
    const byName = Object.fromEntries(s.users.map((u) => [u.firstName, u]));
    expect(byName.Laith).toMatchObject({ gender: 'M', seedLogin: 'laith', friendCode: 'LAIT26', isSim: false });
    expect(byName.Yazeed).toMatchObject({ role: 'driver', seedLogin: 'yazeed' });
    expect(s.drivers[0]).toMatchObject({ car: 'White Hyundai Elantra', plate: '12-34567' });
    expect(s.users.filter((u) => u.gender === 'F' && u.role === 'rider').length).toBeGreaterThan(0);   // other-gender riders for the gender rule
    expect(SIM_ORDER.map((r) => r.firstName)).toEqual(['Deya\'a', 'Adnan', 'Noor', 'Rasha', 'Hala']);   // Rasha, Hala: women-only demo
    expect(new Set(s.users.map((u) => u.friendCode)).size).toBe(s.users.length);
  });

  it('seeds an empty store once, with a paused clock at the demo start', async () => {
    const store = createMemoryStore();
    expect(await store.withLock((r) => seedIfEmpty(r, cfg))).toBe(true);
    expect(await store.withLock((r) => seedIfEmpty(r, cfg))).toBe(false);
    const demo = await store.withLock((r) => r.getDemoState());
    expect(demo).toMatchObject({ epoch: 1, nowIso: '2026-11-29T06:10:00.000+03:00', paused: true });
  });

  it('reset wipes everything, bumps the epoch and gives everyone new tokens', async () => {
    const store = createMemoryStore();
    await store.withLock((r) => seedIfEmpty(r, cfg));
    const before = await store.withLock((r) => r.getUserBySeedLogin('laith'));
    await store.withLock(async (r) => { await r.putUser({ ...before!, outstandingP: 230 }); });
    const epoch = await store.withLock((r) => resetToSeed(r, cfg));
    const after = await store.withLock((r) => r.getUserBySeedLogin('laith'));
    expect(epoch).toBe(2);
    expect(after).toMatchObject({ epoch: 2, outstandingP: 0 });
    expect(after!.token).not.toBe(before!.token);
  });
});

describe('seeded Uni plan (SPEC §2.6)', () => {
  it('Huda has a semester plan: Arabella → JUST, Mon–Thu 8:00, nothing on demo Sunday', async () => {
    const store = createMemoryStore();
    await store.withLock((r) => seedIfEmpty(r, cfg));
    const [sub, trips] = await store.withLock(async (r) => [await r.getSubscription('u-huda'), await r.listPlannedTrips('u-huda')] as const);
    expect([sub!.kind, sub!.replacementsLeft, trips.length]).toEqual(['semester', 1, 36]);
    expect(trips[0]).toMatchObject({ arriveBy: '2026-11-30T08:00:00.000+03:00', state: 'PLANNED' });
    expect(trips.every((t) => t.pickup.key === 'AM' && t.dest.key === 'JUST')).toBe(true);
  });
});

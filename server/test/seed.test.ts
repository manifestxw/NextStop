import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '../src/store/memoryRepo.js';
import { loadSeed, seedIfEmpty, resetToSeed, SIM_ORDER } from '../src/store/seed.js';
import { parseConfig } from '../src/config.js';

const cfg = parseConfig({});

describe('seed (SPEC §2.6)', () => {
  it('has the 6 places with area names, the demo accounts and Omar', () => {
    const s = loadSeed();
    expect(s.places.map((p) => p.key)).toEqual(['CC', 'HS', 'US', 'YU', 'AM', 'JUST']);
    expect(s.places.find((p) => p.key === 'CC')?.area).toBe('City Center area');
    const byName = Object.fromEntries(s.users.map((u) => [u.firstName, u]));
    expect(byName.Lina).toMatchObject({ gender: 'F', seedLogin: 'lina', friendCode: 'LINA26', isSim: false });
    expect(byName.Omar).toMatchObject({ role: 'driver', seedLogin: 'omar' });
    expect(s.drivers[0]).toMatchObject({ car: 'White Hyundai Elantra', plate: '12-34567' });
    expect(s.users.filter((u) => u.gender === 'M' && u.role === 'rider').length).toBeGreaterThan(0);
    expect(SIM_ORDER.map((r) => r.firstName)).toEqual(['Rania', 'Dana', 'Noor']);
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
    const before = await store.withLock((r) => r.getUserBySeedLogin('lina'));
    await store.withLock(async (r) => { await r.putUser({ ...before!, outstandingP: 230 }); });
    const epoch = await store.withLock((r) => resetToSeed(r, cfg));
    const after = await store.withLock((r) => r.getUserBySeedLogin('lina'));
    expect(epoch).toBe(2);
    expect(after).toMatchObject({ epoch: 2, outstandingP: 0 });
    expect(after!.token).not.toBe(before!.token);
  });
});

// T24 (P2, SPEC §4.6): drivers nearby moves the automatic ready check; traffic and weather change travel times.
import { describe, expect, it } from 'vitest';
import { makeHarness, trip, rider } from './helpers.js';

async function linaAlone(drivers?: 2 | 8 | 20) {
  const h = await makeHarness();
  if (drivers) await h.cmd.demo.settings({ driversNearby: drivers });
  const lina = await h.login('lina');
  const ride = rider(await h.cmd.createRide(lina, trip('CC'))).ride!;   // first pickup 7:15
  return { ...h, lina, ride };
}

describe('supply-aware ready check (SPEC §4.6)', () => {
  it('default (20 drivers): first pickup − 45, no warning', async () => {
    const { ride } = await linaAlone();
    expect([ride.findDriverAutoAt.slice(11, 16), ride.fewDrivers]).toEqual(['06:30', undefined]);
  });
  it('8 drivers: − 60', async () => {
    const { ride } = await linaAlone(8);
    expect(ride.findDriverAutoAt.slice(11, 16)).toBe('06:15');
  });
  it('2 drivers: − 75 and the host sees "few drivers nearby"; the tick starts it then', async () => {
    const { cmd, lina, ride, store } = await linaAlone(2);
    expect([ride.findDriverAutoAt.slice(11, 16), ride.fewDrivers]).toEqual(['06:00', true]);
    await cmd.demo.clock({ advanceMin: 1 });                                // already past 6:00 → starts now
    expect((await store.withLock((r) => r.getRide(ride.id)))!.state).toBe('READY_CHECK');
    void lina;
  });
});

describe('traffic and weather (SPEC §2.5, §4.3)', () => {
  it('heavy traffic and rain make the same solo trip start earlier and cost more', async () => {
    const h = await makeHarness();
    const lina = await h.login('lina');
    const q = async () => (await h.cmd.quote(lina, { pickup: { key: 'CC' }, dest: { key: 'JUST' }, arriveBy: '2026-11-29T08:00:00+03:00' })).categories[0]!;
    const normal = await q();
    await h.cmd.demo.settings({ traffic: 'jam', weather: 'rain' });
    const bad = await q();
    expect([bad.beReadyBy < normal.beReadyBy, bad.soloJod > normal.soloJod]).toEqual([true, true]);
  });
});

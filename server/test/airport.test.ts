// T21: Airport rides on the stage data (SPEC §3.16). Destination = Queen Alia Airport means Airport.
import { describe, expect, it } from 'vitest';
import { makeHarness, rider } from './helpers.js';

const toAirport = (pickup: string, by: string) => ({ pickup: { key: pickup }, dest: { key: 'QAIA' }, arriveBy: by, category: 'airport' as const, sameGenderOnly: true });

describe('Airport category (stage data)', () => {
  it('quotes only Airport for the airport, with the wide zone and 3 seats; two riders share the car', async () => {
    const h = await makeHarness({ stage: true });
    const lina = await h.login('lina'), sara = await h.login('sara');
    const q = await h.cmd.quote(lina, { pickup: { key: 'CC' }, dest: { key: 'QAIA' }, arriveBy: '2026-11-29T10:00:00+03:00' });
    const avail = q.categories.filter((c) => c.available).map((c) => c.category);
    const ap = q.categories.find((c) => c.category === 'airport')!;
    expect([avail, ap.maxRiders, ap.estimates.length, ap.zoneKm.dest, ap.zoneKm.pickup >= 3]).toEqual([['airport'], 3, 3, 1, true]);
    const ride = rider(await h.cmd.createRide(lina, toAirport('CC', '2026-11-29T10:00:00+03:00'))).ride!;
    expect([ride.category, ride.seatsLeft]).toEqual(['airport', 2]);
    await h.cmd.join(sara, ride.id, toAirport('US', '2026-11-29T10:15:00+03:00'));   // ±20 min window
    const v = rider(await h.cmd.me(lina)).ride!;
    expect([v.seats.length, v.shareJod < ap.soloJod]).toEqual([2, true]);
  });

  it('an Economy trip to the airport becomes Airport', async () => {
    const h = await makeHarness({ stage: true });
    const lina = await h.login('lina');
    const v = rider(await h.cmd.createRide(lina, { ...toAirport('CC', '2026-11-29T10:00:00+03:00'), category: 'economy' })).ride!;
    expect(v.category).toBe('airport');
  });
});

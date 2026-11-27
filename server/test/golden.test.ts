// Golden values = what docs/reference/fare_model.py prints (SPEC §4.7, §4.7.1). Fixed table, CALIBRATION 1.00.
import { describe, expect, it } from 'vitest';
import { LOC, KEYS, sun, type Key } from './fixtures/places.js';
import { fixedMatrix, anchorRoute } from '../src/travel/fixed.js';
import { plan, solo } from '../src/engine/plan.js';
import { up05, pyRound } from '../src/engine/pyRound.js';
import { checkJoin, type RideIn } from '../src/engine/matching.js';
import { leave } from '../src/engine/leave.js';
import { distPointPolylineKm } from '../src/engine/geo.js';
import { CATEGORY, zone, seats, genderOk } from '../src/engine/zone.js';
import { ammanParts } from '../src/clock/amman.js';
import type { RiderIn } from '../src/engine/types.js';

const idx = (k: Key) => KEYS.indexOf(k);
const M = fixedMatrix(KEYS.map((k) => LOC[k]));
const hhmm = (us: number) => { const p = ammanParts(us); return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`; };
const F = (id: string, p: Key, by: number, extra: Partial<RiderIn> = {}): RiderIn =>
  ({ id, gender: 'F', p: idx(p), d: idx('JUST'), by, ...extra });
const fmt2 = (x: number) => pyRound(x, 2).toFixed(2);

describe('golden: solo Irbid City Center → JUST, Sunday (SPEC §4.7)', () => {
  const rows: [number, number, string, number, string, string][] = [
    [3, 0, '02:28', 27, '8.26', '8.30'], [7, 30, '06:48', 37, '7.60', '7.60'],
    [8, 0, '07:15', 40, '7.81', '7.85'], [11, 0, '10:21', 34, '7.43', '7.45'],
    [15, 0, '14:17', 38, '7.70', '7.70'], [22, 0, '21:26', 29, '7.16', '7.20'],
  ];
  it.each(rows)('arrive %i:%i', (h, m, pickup, trip, fare, rounded) => {
    const s = solo(M, F('Lina', 'CC', sun(h, m)))!;
    expect([hhmm(s.T0), pyRound(s.dur, 0), s.km, fmt2(s.fare), fmt2(up05(s.fare))]).toEqual([pickup, trip, 19.3, fare, rounded]);
  });
});

describe('golden: fixture riders (Rania 8:15)', () => {
  const FIX = [F('Lina', 'CC', sun(8, 0)), F('Sara', 'US', sun(8, 0)), F('Rania', 'HS', sun(8, 15)), F('Dana', 'YU', sun(8, 0))];

  it('solo fare per seeded rider', () => {
    const got = [...FIX, F('Noor', 'AM', sun(8, 0))].map((r) => fmt2(up05(solo(M, r)!.fare)));
    expect(got).toEqual(['7.85', '6.90', '7.10', '6.70', '6.05']);
  });

  it.each([
    ['normal', 'clear', '07:02', 54, '9.03', '2.30'], ['heavy', 'clear', '06:54', 61, '9.49', '2.40'],
    ['jam', 'clear', '06:42', 72, '10.12', '2.55'], ['normal', 'rain', '06:56', 59, '9.38', '2.35'],
  ] as const)('4 riders, %s/%s', (level, weather, pickup, trip, fare, each) => {
    const p = plan(fixedMatrix(KEYS.map((k) => LOC[k]), { level, weather }), FIX)!;
    expect([hhmm(p.T0), pyRound(p.dur, 0), fmt2(p.fare), fmt2(up05(p.fare / 4)), p.km]).toEqual([pickup, trip, fare, each, 21.4]);
  });

  it('rule 5 distances to the CC → JUST anchor route', () => {
    const route = anchorRoute(LOC.CC, LOC.JUST);
    expect((['HS', 'US', 'YU', 'AM'] as const).map((k) => pyRound(distPointPolylineKm(LOC[k], route), 1))).toEqual([0.8, 0.3, 1.0, 0.9]);
  });
});

describe('golden: v5 demo (SPEC §2.3)', () => {
  const now = sun(6, 10);
  const lina = F('Lina', 'CC', sun(8, 0)), sara = F('Sara', 'US', sun(8, 0));
  const rania = F('Rania', 'HS', sun(8, 5)), dana = F('Dana', 'YU', sun(8, 0));

  function demoRide() {
    const s = solo(M, lina)!;
    const ride: RideIn = { riders: [lina], firstShown: { Lina: s.T0 }, share: up05(s.fare), anchorRoute: anchorRoute(LOC.CC, LOC.JUST) };
    const steps: string[] = [`${fmt2(s.fare)}/${fmt2(ride.share)} ${hhmm(s.T0)}`];
    let p = s;
    for (const j of [sara, rania, dana]) {
      const r = checkJoin(M, ride, j, now);
      expect(r.reason).toBe('ok');
      ride.riders.push(j); ride.share = r.share!; p = r.plan!;
      ride.firstShown[j.id] = p.pick[ride.riders.length - 1]!;
      steps.push(`${fmt2(p.fare)}/${fmt2(r.share!)} ` + ride.riders.map((m, i) => `${m.id} ${hhmm(p.pick[i]!)}`).join(', '));
    }
    return { ride, p, steps };
  }

  it('joins: 7.81/7.85 → 7.95/4.00 → 8.67/2.90 → 9.03/2.30 with the shown pickups', () => {
    const { steps } = demoRide();
    expect(steps).toEqual([
      '7.81/7.85 07:15',
      '7.95/4.00 Lina 07:12, Sara 07:21',
      '8.67/2.90 Lina 07:05, Sara 07:20, Rania 07:13',
      '9.03/2.30 Lina 07:02, Sara 07:17, Rania 07:10, Dana 07:22',
    ]);
  });

  it('host estimates 7.85 · 4.15 · 2.95 · 2.35', () => {
    const s = solo(M, lina)!;
    expect(Object.entries(CATEGORY.economy.A).map(([k, a]) => fmt2(up05(s.fare * a / Number(k))))).toEqual(['7.85', '4.15', '2.95', '2.35']);
  });

  it('Sara leaves late at 6:35: 8.86, each 2.20, credit 2.30, pickups frozen; free at 6:20: 3.00', () => {
    const { p } = demoRide();
    const late = leave(M, p, 1, 4, 2.3, sun(6, 35));
    expect([fmt2(late.fare), fmt2(late.share), fmt2(late.charge), late.late]).toEqual(['8.86', '2.20', '2.30', true]);
    expect(Object.entries(late.frozen).map(([i, t]) => `${i} ${hhmm(t)}`)).toEqual(['0 07:02', '2 07:10', '3 07:22']);
    expect(pyRound(3 * late.share + late.charge - late.fare, 2)).toBe(0.04);
    const free = leave(M, p, 1, 4, 2.3, sun(6, 20));
    expect([fmt2(free.fare), fmt2(free.share), free.late]).toEqual(['8.86', '3.00', false]);
  });
});

describe('golden: v6–v7 (SPEC §4.7.1)', () => {
  it('zones by category', () => {
    expect([zone('economy', 19.3), zone('economy', 85), zone('comfort', 19.3), zone('airport', 35), zone('airport', 110)])
      .toEqual([[1.5, 1.0], [4.0, 2.5], [1.2, 0.8], [5.2, 1.0], [10.0, 1.0]]);
  });

  it('rule 1 gender modes', () => {
    const ride = (genderMode: 'same' | 'mixed'): Pick<RideIn, 'riders' | 'genderMode'> => ({ riders: [F('Lina', 'CC', 0)], genderMode });
    const man = { id: 'M', gender: 'M' as const, p: 0, d: 5, by: 0 };
    expect([
      genderOk(ride('same'), F('Sara', 'US', 0)),
      genderOk(ride('same'), { ...man, sameGenderOnly: false }),
      genderOk(ride('mixed'), F('Sara', 'US', 0)),
      genderOk(ride('mixed'), { ...man, sameGenderOnly: false }),
      genderOk(ride('same'), F('Sara', 'US', 0, { guest: { gender: 'M' } })),
    ]).toEqual([true, false, false, true, false]);
  });

  it('Comfort CC → JUST 8:00: 9.76 / 9.80, estimates 9.80 · 5.10 · 3.55; Sara joins 9.94 / 5.00', () => {
    const c = CATEGORY.comfort;
    const s = solo(M, F('Lina', 'CC', sun(8, 0)), { priceFactor: c.price, earlyMax: c.early })!;
    expect([fmt2(s.fare), fmt2(up05(s.fare)), ...Object.entries(c.A).map(([k, a]) => fmt2(up05(s.fare * a / Number(k))))])
      .toEqual(['9.76', '9.80', '9.80', '5.10', '3.55']);
    const ride: RideIn = { riders: [F('Lina', 'CC', sun(8, 0))], firstShown: { Lina: s.T0 }, share: up05(s.fare),
      category: 'comfort', anchorRoute: anchorRoute(LOC.CC, LOC.JUST) };
    const r = checkJoin(M, ride, F('Sara', 'US', sun(8, 0), { category: 'comfort' }), sun(6, 10));
    expect([r.reason, fmt2(r.plan!.fare), fmt2(r.share!)]).toEqual(['ok', '9.94', '5.00']);
  });

  it('+1: same fare, one more seat (7.95 / 4.00 → 2.65)', () => {
    const riders = [F('Lina', 'CC', sun(8, 0)), F('Sara', 'US', sun(8, 0), { guest: { gender: 'F' } })];
    const p = plan(M, riders)!;
    expect([fmt2(p.fare), seats(riders), fmt2(up05(p.fare / seats(riders)))]).toEqual(['7.95', 3, '2.65']);
  });
});

describe('model unit tests (docs/reference/test_fare_model.py)', () => {
  // Co-located stops yield the 1 JD minimum fare after removal.
  const start = sun(7, 0);
  const cc = idx('CC');
  const p3 = { T0: start, pick: { 0: start, 1: start, 2: start },
    stops: (['P', 'D'] as const).flatMap((kind) => [0, 1, 2].map((i) => ({ kind, rider: i, at: cc }))) } as never;

  it('second late leave subtracts both credits', () => {
    const r = leave(M, p3, 1, 3, 0.35, start, { existingCredits: 0.15 });
    expect([r.fare, r.share, r.charge, r.late]).toEqual([1.0, 0.25, 0.35, true]);
  });
  it('free leave during redispatch preserves credit', () => {
    const r = leave(M, p3, 1, 3, 0.35, start, { existingCredits: 0.15, driverAssigned: false });
    expect([r.fare, r.share, r.charge, r.late]).toEqual([1.0, 0.45, 0.0, false]);
  });
  it('last rider cancels without a new charge', () => {
    const one = { T0: start, pick: { 0: start }, stops: [{ kind: 'P', rider: 0, at: cc }, { kind: 'D', rider: 0, at: cc }] } as never;
    expect(leave(M, one, 0, 1, 0.35, start, { existingCredits: 0.15 })).toEqual({ fare: 0, share: 0, charge: 0, late: false, frozen: {} });
  });
});

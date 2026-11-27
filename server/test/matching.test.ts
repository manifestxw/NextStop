// Each matching rule's reject path (SPEC §3.5). The pass path is the demo in golden.test.ts.
import { describe, expect, it } from 'vitest';
import { LOC, KEYS, sun, type Key } from './fixtures/places.js';
import { fixedMatrix, anchorRoute } from '../src/travel/fixed.js';
import { solo } from '../src/engine/plan.js';
import { up05 } from '../src/engine/pyRound.js';
import { checkJoin, type RideIn } from '../src/engine/matching.js';
import type { RiderIn } from '../src/engine/types.js';

const RAMTHA = { lat: 32.5592, lng: 36.0069 };   // ~15 km from the CC → JUST route
const points = [...KEYS.map((k) => LOC[k]), RAMTHA];
const M = fixedMatrix(points);
const at = (k: Key | 'RAMTHA') => (k === 'RAMTHA' ? points.length - 1 : KEYS.indexOf(k));
const R = (id: string, p: Key | 'RAMTHA', by = sun(8, 0), extra: Partial<RiderIn> = {}): RiderIn =>
  ({ id, gender: 'F', p: at(p), d: at('JUST'), by, ...extra });

function linaRide(extra: Partial<RideIn> = {}): RideIn {
  const lina = R('Lina', 'CC');
  const s = solo(M, lina)!;
  return { riders: [lina], firstShown: { Lina: s.T0 }, share: up05(s.fare), anchorRoute: anchorRoute(LOC.CC, LOC.JUST), ...extra };
}
const reason = (ride: RideIn, j: RiderIn, now = sun(6, 10)) => checkJoin(M, ride, j, now).reason;

describe('matching: every rule rejects', () => {
  it('rule 1: a man never joins a same-gender women ride; categories never mix', () => {
    expect(reason(linaRide(), R('Omar2', 'US', sun(8, 0), { gender: 'M', sameGenderOnly: false }))).toBe('rule 1 gender');
    expect(reason(linaRide(), R('Sara', 'US', sun(8, 0), { category: 'comfort' }))).toBe('rule 1 category');
  });
  it('rule 1: toggle-on rider never joins a mixed ride', () => {
    expect(reason(linaRide({ genderMode: 'mixed' }), R('Sara', 'US'))).toBe('rule 1 gender');
  });
  it('rule 2: full, counting +1 seats (Economy 4, Comfort 3)', () => {
    const ride = linaRide();
    ride.riders.push(R('A', 'HS', sun(8, 0), { guest: { gender: 'F' } }), R('B', 'YU'));
    expect(reason(ride, R('Sara', 'US'))).toBe('rule 2 full');
    const comfort = linaRide({ category: 'comfort' });
    comfort.riders.push(R('A', 'HS', sun(8, 0), { category: 'comfort' }));
    expect(reason(comfort, R('Sara', 'US', sun(8, 0), { category: 'comfort', guest: { gender: 'F' } }))).toBe('rule 2 full');
  });
  it('rule 4: arrive-by more than 5 min from the host', () => {
    expect(reason(linaRide(), R('Sara', 'US', sun(8, 6)))).toBe('rule 4 arrive-by');
  });
  it('rule 5: pickup outside the sync zone', () => {
    expect(reason(linaRide(), R('Far', 'RAMTHA'))).toBe('rule 5 pickup far');
  });
  it('rule 6: destination outside the zone', () => {
    expect(reason(linaRide(), { ...R('Sara', 'US'), d: at('AM') })).toBe('rule 6 destination far');
  });
  it('rule 11: too late to join (new first pickup < now + 45 min)', () => {
    expect(reason(linaRide(), R('Sara', 'US'), sun(6, 30))).toBe('rule 11 too late to join');
  });
  it('rule 10: share would not beat the joiner\'s own solo fare', () => {
    const ride = linaRide();
    ride.share = 0.5;   // pretend the ride is already cheaper than any new plan
    expect(reason(ride, R('Sara', 'US'))).toBe('rule 10 share goes up');
  });
});

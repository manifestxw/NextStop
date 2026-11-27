// Categories, sync zones, seats and rule 1 (SPEC §3.16, §3.17 A; fare_model.py CATEGORY, zone, seats, gender_ok).
import { pyRound } from './pyRound.js';
import type { Category, GenderMode, RiderIn } from './types.js';

interface CategoryRow {
  maxRiders: number; price: number;
  pick: [rate: number, floorKm: number, ceilKm: number];
  dest: [rate: number, floorKm: number, ceilKm: number];
  window: number; early: number;
  detour: [addMin: number, mult: number];
  A: Record<number, number>;   // host-estimate detour allowance by rider count
}

export const CATEGORY: Record<Category, CategoryRow> = {
  economy: { maxRiders: 4, price: 1.0, pick: [0.075, 1.5, 4.0], dest: [0.05, 1.0, 2.5], window: 5, early: 25, detour: [10, 1.4], A: { 1: 1.0, 2: 1.05, 3: 1.12, 4: 1.2 } },
  comfort: { maxRiders: 3, price: 1.25, pick: [0.06, 1.0, 3.0], dest: [0.04, 0.75, 2.0], window: 5, early: 25, detour: [8, 1.25], A: { 1: 1.0, 2: 1.04, 3: 1.08 } },
  airport: { maxRiders: 3, price: 1.0, pick: [0.15, 3.0, 10.0], dest: [0.0, 1.0, 1.0], window: 20, early: 45, detour: [15, 1.25], A: { 1: 1.0, 2: 1.05, 3: 1.1 } },
};

const clampZone = ([rate, lo, hi]: [number, number, number], L: number) => pyRound(Math.min(hi, Math.max(lo, rate * L)), 1);

/** [pickup km, destination km] for a ride, from its anchor route's road km. Fixed at creation. */
export const zone = (category: Category, anchorKm: number): [number, number] =>
  [clampZone(CATEGORY[category].pick, anchorKm), clampZone(CATEGORY[category].dest, anchorKm)];

/** Seats used = riders + their +1s. The share divisor. */
export const seats = (riders: Pick<RiderIn, 'guest'>[]) => riders.reduce((n, r) => n + (r.guest ? 2 : 1), 0);

export const detourCap = (soloIncar: number, category: Category = 'economy') => {
  const [add, mult] = CATEGORY[category].detour;
  return Math.max(soloIncar + add, soloIncar * mult);
};

/** Rule 1. `same` ride: joiner (and +1) must be the ride's gender, toggle ignored. `mixed`: joiner's toggle off. */
export function genderOk(ride: { riders: RiderIn[]; genderMode?: GenderMode }, j: RiderIn): boolean {
  if ((ride.genderMode ?? 'same') === 'same') {
    const g = ride.riders[0]!.gender;
    return j.gender === g && (!j.guest || j.guest.gender === g);
  }
  return !(j.sameGenderOnly ?? true);
}

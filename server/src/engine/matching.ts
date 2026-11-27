// Matching rules 1, 2, 4–11 for one joiner (SPEC §3.5; fare_model.py check_join).
// Rules 3 (ride state) and 12 (one ride at a time) are checked by the domain layer.
import { MIN_LEAD_TO_JOIN, PICKUP_SHIFT_MAX } from './constants.js';
import { distPointPolylineKm, hav } from './geo.js';
import { plan, solo } from './plan.js';
import { up05 } from './pyRound.js';
import { minutesBetween, US_PER_MIN } from './time.js';
import { CATEGORY, detourCap, genderOk, seats, zone } from './zone.js';
import type { Category, GenderMode, LatLng, Plan, RiderIn, TimedMatrix, Us } from './types.js';

export interface RideIn {
  riders: RiderIn[];                     // host first
  firstShown: Record<string, Us>;        // rider id → first pickup time they were shown (rule 9)
  share: number;                         // current share in JOD
  anchorRoute: LatLng[];                 // host pickup → destination polyline (rule 5)
  category?: Category;                   // default economy
  genderMode?: GenderMode;               // default same
  zone?: [number, number];               // stored at creation; computed from the host's solo km if absent
}

export interface JoinResult { ok: boolean; reason: string; plan?: Plan; share?: number }

const no = (reason: string): JoinResult => ({ ok: false, reason });

/** `calibration` = env CALIBRATION (1.00 in the golden tests); it multiplies the category price like the model. */
export function checkJoin(m: TimedMatrix, ride: RideIn, j: RiderIn, now: Us, calibration = 1.0): JoinResult {
  const { riders } = ride, host = riders[0]!;
  const catName = ride.category ?? 'economy', cat = CATEGORY[catName];
  const priceFactor = calibration * cat.price;
  if (!genderOk(ride, j)) return no('rule 1 gender');
  if ((j.category ?? 'economy') !== catName) return no('rule 1 category');
  if (seats(riders) + seats([j]) > cat.maxRiders) return no('rule 2 full');
  if (Math.abs(minutesBetween(host.by, j.by)) > cat.window) return no('rule 4 arrive-by');
  const [zPick, zDest] = ride.zone ?? zone(catName, solo(m, host, { priceFactor })!.km);
  const pt = (i: number) => m.points[i]!;
  const dPick = Math.min(hav(pt(j.p), pt(host.p)), distPointPolylineKm(pt(j.p), ride.anchorRoute));
  if (dPick > zPick) return no('rule 5 pickup far');
  if (hav(pt(j.d), pt(host.d)) > zDest) return no('rule 6 destination far');

  const all = [...riders, j];
  const opts = { earlyMax: cat.early, priceFactor };
  const soloIncar = all.map((r) => solo(m, r, opts)!.incar[0]!);
  const ok89 = (res: Plan) => {
    for (const i of Object.keys(res.incar)) if (res.incar[+i]! > detourCap(soloIncar[+i]!, catName) + 1e-9) return false;   // rule 8
    return riders.every((r, i) => minutesBetween(res.pick[i]!, ride.firstShown[r.id]!) <= PICKUP_SHIFT_MAX);            // rule 9
  };
  const p = plan(m, all, { ...opts, extraOk: ok89 });
  if (!p) return no('rules 7-9 no valid stop order');
  const share = up05(p.fare / seats(all));
  if (share > ride.share + 1e-9) return no('rule 10 share goes up');
  if (share >= up05(solo(m, j, opts)!.fare)) return no('rule 10 not cheaper than solo');
  if (p.T0 < now + MIN_LEAD_TO_JOIN * US_PER_MIN) return no('rule 11 too late to join');
  return { ok: true, reason: 'ok', plan: p, share };
}

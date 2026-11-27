import { BUFFER, EARLY_MAX } from './constants.js';
import { evaluate } from './fare.js';
import { floorMinute, minutesBetween, US_PER_MIN, US_PER_SEC } from './time.js';
import type { Plan, RiderIn, Stop, TimedMatrix, Us } from './types.js';

export interface PlanOptions { extraOk?: (p: Plan) => boolean; earlyMax?: number; priceFactor?: number }

/** Latest whole-minute first pickup so the last drop-off is ≤ deadline (SPEC §3.6). */
export function latestStart(m: TimedMatrix, stops: Stop[], deadline: Us, priceFactor = 1.0): Us | null {
  const lastDrop = (T: Us) => {
    const ev = evaluate(m, stops, T, priceFactor);
    let ld = -Infinity;
    stops.forEach((s, j) => { if (s.kind === 'D') ld = Math.max(ld, ev.times[j]!); });
    return ld;
  };
  let T0 = deadline - 60 * US_PER_MIN;
  for (let k = 0; k < 6; k++) T0 += deadline - lastDrop(T0);
  T0 = floorMinute(T0) + US_PER_MIN;
  for (let k = 0; k < 40; k++) {
    if (lastDrop(T0) <= deadline + US_PER_SEC) return T0;
    T0 -= US_PER_MIN;
  }
  return null;
}

/** Every precedence-valid stop order, in Python itertools.permutations order (ties keep the first). */
function* orders(n: number): Generator<[Stop['kind'], number][]> {
  const events: [Stop['kind'], number][] = [];
  for (let i = 0; i < n; i++) events.push(['P', i]);
  for (let i = 0; i < n; i++) events.push(['D', i]);
  const used = new Array<boolean>(events.length).fill(false), picked = new Set<number>(), cur: [Stop['kind'], number][] = [];
  function* rec(): Generator<[Stop['kind'], number][]> {
    if (cur.length === events.length) { yield cur.slice(); return; }
    for (let e = 0; e < events.length; e++) {
      if (used[e]) continue;
      const [k, i] = events[e]!;
      if (k === 'D' && !picked.has(i)) continue;   // a drop before its pickup: prune the subtree
      used[e] = true; cur.push(events[e]!); if (k === 'P') picked.add(i);
      yield* rec();
      used[e] = false; cur.pop(); if (k === 'P') picked.delete(i);
    }
  }
  yield* rec();
}

/** fare_model.py plan(): lowest score = fare in piastres + trip minutes + 0.01 × total in-car minutes. */
export function plan(m: TimedMatrix, riders: RiderIn[], { extraOk, earlyMax = EARLY_MAX, priceFactor = 1.0 }: PlanOptions = {}): Plan | null {
  const deadline = Math.min(...riders.map((r) => r.by)) - BUFFER * US_PER_MIN;
  let best: { score: number; res: Plan } | null = null;
  for (const perm of orders(riders.length)) {
    const stops: Stop[] = perm.map(([kind, i]) => ({ kind, rider: i, at: kind === 'P' ? riders[i]!.p : riders[i]!.d }));
    const T0 = latestStart(m, stops, deadline, priceFactor);
    if (T0 === null) continue;
    const ev = evaluate(m, stops, T0, priceFactor);
    const pick: Record<number, Us> = {}, drop: Record<number, Us> = {};
    stops.forEach((s, j) => { (s.kind === 'P' ? pick : drop)[s.rider] = ev.times[j]!; });
    if (Object.keys(drop).some((i) => drop[+i]! < riders[+i]!.by - earlyMax * US_PER_MIN)) continue;
    const incar: Record<number, number> = {};
    for (const i of Object.keys(pick)) incar[+i] = minutesBetween(pick[+i]!, drop[+i]!);
    // Python dicts keep insertion order (pickup order); JS sorts integer keys. Sum in pickup order.
    const pickOrder = stops.filter((s) => s.kind === 'P').map((s) => s.rider);
    const res: Plan = { stops, T0, fare: ev.fare, km: ev.km, dur: ev.dur, incar, pick, drop };
    if (extraOk && !extraOk(res)) continue;
    const score = ev.fare * 100 + ev.dur + 0.01 * pickOrder.reduce((a, i) => a + incar[i]!, 0);
    if (best === null || score < best.score) best = { score, res };
  }
  return best?.res ?? null;
}

export const solo = (m: TimedMatrix, r: RiderIn, opts: PlanOptions = {}) => plan(m, [r], opts);

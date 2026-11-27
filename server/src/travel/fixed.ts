// Fixed-table source (SPEC §4.2.3, §4.3): exact port of fare_model.py leg_km / leg_min / anchor_route.
// Used by the golden tests and as the automatic fallback when Google fails.
import { ammanParts } from '../clock/amman.js';
import { hav } from '../engine/geo.js';
import { pyRound } from '../engine/pyRound.js';
import type { LatLng, TimedMatrix, Us } from '../engine/types.js';
import type { TravelProvider } from './provider.js';

export const JUST: LatLng = { lat: 32.47889, lng: 35.985 };
export const EXIT: LatLng = { lat: 32.52, lng: 35.89 };   // Irbid → Ramtha road exit node
const CIRC_URBAN = 1.35, CIRC_HW = 1.15;
const V_URBAN = 30.0, V_HW = 70.0;

// [hour, urban factor, highway factor], weekday curve; interpolated linearly.
const ANCHORS: [number, number, number][] = [
  [0, 1.0, 1.0], [5, 1.0, 1.0], [6, 1.15, 1.05], [7, 1.55, 1.2], [7.5, 1.75, 1.3], [8, 1.75, 1.3],
  [9, 1.4, 1.15], [11, 1.3, 1.1], [13, 1.45, 1.15], [14.5, 1.6, 1.2], [16, 1.5, 1.15],
  [18, 1.45, 1.15], [20, 1.2, 1.05], [22, 1.05, 1.0], [24, 1.0, 1.0],
];
export const LEVEL = { normal: 1.0, heavy: 1.2, jam: 1.5 } as const;
export const WEATHER = { clear: 1.0, rain: 1.15 } as const;
export interface Conditions { level?: keyof typeof LEVEL; weather?: keyof typeof WEATHER }

function baseFactors(h: number): [number, number] {
  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const [h0, u0, w0] = ANCHORS[i]!, [h1, u1, w1] = ANCHORS[i + 1]!;
    if (h0 <= h && h <= h1) { const f = (h - h0) / (h1 - h0); return [u0 + (u1 - u0) * f, w0 + (w1 - w0) * f]; }
  }
  return [1.0, 1.0];
}

/** Urban and highway congestion factors at the leg's start time (Amman local). */
export function factors(t: Us, { level = 'normal', weather = 'clear' }: Conditions = {}): [number, number] {
  const p = ammanParts(t);
  let [u, hw] = baseFactors(p.hour + p.minute / 60 + p.second / 3600);
  if (p.weekday === 5 || p.weekday === 6) { u = 1 + (u - 1) * 0.5; hw = 1 + (hw - 1) * 0.5; }   // Fri/Sat: half
  const m = LEVEL[level] * WEATHER[weather];
  return [u * m, hw * m];
}

const same = (a: LatLng, b: LatLng) => a.lat === b.lat && a.lng === b.lng;
const isJust = (p: LatLng) => hav(p, JUST) <= 1.0;   // ARCH §5: "is JUST" = within 1 km of JUST

/** [urban km, highway km], each rounded to 0.1 like the model. */
export function legKm(a: LatLng, b: LatLng): [number, number] {
  if (same(a, b)) return [0.0, 0.0];
  if (isJust(a) || isJust(b)) {
    const o = isJust(a) ? b : a;
    return [pyRound(hav(o, EXIT) * CIRC_URBAN, 1), pyRound(hav(EXIT, JUST) * CIRC_HW, 1)];
  }
  return [pyRound(hav(a, b) * CIRC_URBAN, 1), 0.0];
}

/** Fixed-table anchor route: via the exit node for trips to or from JUST. */
export const anchorRoute = (p: LatLng, d: LatLng): LatLng[] => (isJust(p) || isJust(d) ? [p, EXIT, d] : [p, d]);

export function fixedMatrix(points: LatLng[], cond: Conditions = {}): TimedMatrix {
  const legs = points.map((a) => points.map((b) => legKm(a, b)));
  const leg = (i: number, j: number) => legs[i]![j]!;
  return {
    points,
    km: (i, j) => { const [u, hw] = leg(i, j); return u + hw; },
    legMin: (i, j, t) => { const [u, hw] = leg(i, j); const [fu, fh] = factors(t, cond); return u / V_URBAN * 60 * fu + hw / V_HW * 60 * fh; },
    freeMin: (i, j) => { const [u, hw] = leg(i, j); return u / V_URBAN * 60 + hw / V_HW * 60; },
  };
}

/** Fixed-table TravelProvider: deterministic, offline. Routes are straight segments via the exit node for JUST legs. */
export const fixedProvider: TravelProvider = {
  name: 'fixed',
  getMatrix: async (points, _departure, cond = {}) => ({ kind: 'fixed', points, cond }),
  getRoute: async (points) => {
    const out: LatLng[] = points.slice(0, 1);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!, b = points[i]!;
      if (!same(a, b) && (isJust(a) || isJust(b))) out.push(EXIT);
      out.push(b);
    }
    return out;
  },
};

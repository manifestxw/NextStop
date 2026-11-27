// Demand spots (SPEC §3.18): k-means on pickup history, nearest busy spot for an idle driver.
// Exact port of fare_model.py mulberry32 / sample_history / kmeans / demand_spots. Pure and deterministic.
import { ammanParts } from '../clock/amman.js';
import { factors } from '../travel/fixed.js';
import { hav, radians, xyKm } from './geo.js';
import type { LatLng, Us } from './types.js';

export const DEMAND_REF: LatLng = { lat: 32.5568, lng: 35.8469 };   // projection origin (Irbid City Center, fixed table)
export const DEMAND_SEED = 2026;
const K_MAX = 5, MIN_POINTS = 5, WINDOW_MIN = 60, MAX_ITER = 50, TIE_KM = 0.5;
const CIRC_URBAN = 1.35, V_URBAN = 30;
const DAY_US = 86_400_000_000, MIN_US = 60_000_000;
const AREA: Record<string, string> = { CC: 'City Center area', HS: 'Al-Hashmi area', US: 'University Street area', YU: 'Yarmouk area', AM: 'Arabella area', JUST: 'JUST' };

export interface DemandPoint extends LatLng { at: Us }
export interface Spot { center: LatLng; area: string; points: number; radiusKm: number; perHour: number; km: number; min: number; straightKm: number }

/** Tiny portable PRNG; identical numbers to the Python reference (and to the JS original). */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t = ((t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fromXyKm([x, y]: [number, number], ref = DEMAND_REF): LatLng {
  const kx = 111.32 * Math.cos(radians(ref.lat)), ky = 110.57;
  return { lat: ref.lat + y / ky, lng: ref.lng + x / kx };
}

const isWeekend = (t: Us) => { const w = ammanParts(t).weekday; return w === 5 || w === 6; };   // Fri/Sat

/** Synthetic pickups for the demo (SPEC §2.6): Sun–Thu 60/day (60% at 6:30–8:30), Fri/Sat 15/day, sigma 0.4 km. */
export function sampleHistory(places: Record<string, LatLng>, seed = DEMAND_SEED, weeks = 4, lastDayUs = Date.UTC(2026, 10, 27, 21, 0) * 1000): DemandPoint[] {
  const rnd = mulberry32(seed);
  const hot: [string, number][] = [['US', 0.3], ['YU', 0.25], ['CC', 0.2], ['HS', 0.15], ['AM', 0.1]];
  const gauss = () => { const u1 = Math.max(rnd(), 1e-12), u2 = rnd(); return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); };
  const pts: DemandPoint[] = [];
  for (let d = weeks * 7 - 1; d >= 0; d--) {
    const day = lastDayUs - d * DAY_US;   // Amman midnight (lastDayUs = Sat 28 Nov 00:00 +03:00)
    const n = isWeekend(day) ? 15 : 60;
    for (let i = 0; i < n; i++) {
      const r = rnd();
      let acc = 0, key = hot[hot.length - 1]![0];
      for (const [k, w] of hot) { acc += w; if (r < acc) { key = k; break; } }
      const minute = !isWeekend(day) && rnd() < 0.6 ? 390 + Math.trunc(rnd() * 120) : 360 + Math.trunc(rnd() * 960);
      const base = xyKm(places[key]!, DEMAND_REF);
      const gx = gauss(), gy = gauss();
      pts.push({ ...fromXyKm([base[0] + 0.4 * gx, base[1] + 0.4 * gy]), at: day + minute * MIN_US });
    }
  }
  return pts;
}

/** k-means++ start (mulberry32), then Lloyd until stable or 50 rounds; ties go to the lower cluster. */
export function kmeans(xy: [number, number][], k: number, seed = DEMAND_SEED, maxIter = MAX_ITER) {
  const rnd = mulberry32(seed), n = xy.length;
  const d2 = (a: [number, number], b: [number, number]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
  const centers: [number, number][] = [xy[Math.trunc(rnd() * n)]!];
  while (centers.length < k) {
    const w = xy.map((p) => Math.min(...centers.map((c) => d2(p, c))));
    const tot = w.reduce((a, b) => a + b, 0);
    if (tot === 0) { centers.push(xy[centers.length % n]!); continue; }
    const r = rnd() * tot;
    let acc = 0, pick = n - 1;
    for (let i = 0; i < n; i++) { acc += w[i]!; if (acc >= r) { pick = i; break; } }
    centers.push(xy[pick]!);
  }
  let assign = new Array<number>(n).fill(-1);
  for (let it = 0; it < maxIter; it++) {
    const next = xy.map((p) => { let best = 0; for (let c = 1; c < k; c++) if (d2(p, centers[c]!) < d2(p, centers[best]!)) best = c; return best; });
    if (next.every((v, i) => v === assign[i])) break;
    assign = next;
    for (let c = 0; c < k; c++) {
      const mem = xy.filter((_, i) => assign[i] === c);
      if (mem.length) centers[c] = [mem.reduce((a, p) => a + p[0], 0) / mem.length, mem.reduce((a, p) => a + p[1], 0) / mem.length];
    }
  }
  return { centers, assign };
}

/** Spots for the next hour on the same day type, nearest first; the busier one wins within 0.5 km. */
export function demandSpots(points: DemandPoint[], driverAt: LatLng, now: Us, places: Record<string, LatLng>, weeks = 4): { spots: Spot[]; best: Spot | null; inside: boolean } {
  const np = ammanParts(now), nowTod = np.hour * 60 + np.minute, wk = isWeekend(now);
  const win = points.filter((p) => {
    const t = ammanParts(p.at), tod = t.hour * 60 + t.minute;
    return isWeekend(p.at) === wk && (((tod - nowTod) % 1440) + 1440) % 1440 < WINDOW_MIN;
  });
  const k = Math.min(K_MAX, Math.floor(win.length / MIN_POINTS));
  if (k === 0) return { spots: [], best: null, inside: false };
  const xy = win.map((p) => xyKm(p, DEMAND_REF));
  const { centers, assign } = kmeans(xy, k);
  const uf = factors(now)[0];
  const spots: Spot[] = [];
  for (let c = 0; c < k; c++) {
    const mem = xy.filter((_, i) => assign[i] === c);
    if (mem.length < MIN_POINTS) continue;
    const dists = mem.map((p) => Math.hypot(p[0] - centers[c]![0], p[1] - centers[c]![1])).sort((a, b) => a - b);
    const center = fromXyKm(centers[c]!);
    const areaKey = Object.keys(AREA).filter((key) => places[key]).reduce((a, b) => (hav(center, places[b]!) < hav(center, places[a]!) ? b : a));
    const km = hav(driverAt, center) * CIRC_URBAN;
    spots.push({ center, area: AREA[areaKey]!, points: mem.length, radiusKm: dists[Math.ceil(0.8 * dists.length) - 1]!,
      perHour: mem.length / weeks, km, min: km / V_URBAN * 60 * uf, straightKm: hav(driverAt, center) });
  }
  spots.sort((a, b) => a.km - b.km || a.area.localeCompare(b.area));
  if (!spots.length) return { spots: [], best: null, inside: false };
  let best = spots[0]!;
  for (const sp of spots.slice(1)) if (sp.km - spots[0]!.km < TIE_KM && sp.points > best.points) best = sp;
  return { spots, best, inside: best.straightKm <= best.radiusKm };
}

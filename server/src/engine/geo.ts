// Straight-line geometry for rules 5 and 6 (fare_model.py hav, _xy_km, dist_point_*).
import type { LatLng } from './types.js';

const DEG = Math.PI / 180;   // Python math.radians multiplies by this exact constant
export const radians = (x: number) => x * DEG;

export function hav(a: LatLng, b: LatLng): number {
  const R = 6371.0;
  const la1 = radians(a.lat), lo1 = radians(a.lng), la2 = radians(b.lat), lo2 = radians(b.lng);
  const d = Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin((lo2 - lo1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(d));
}

/** Local flat km coordinates around `ref`: [x east, y north]. */
export function xyKm(p: LatLng, ref: LatLng): [number, number] {
  const kx = 111.32 * Math.cos(radians(ref.lat)), ky = 110.57;
  return [(p.lng - ref.lng) * kx, (p.lat - ref.lat) * ky];
}

export function distPointSegmentKm(p: LatLng, a: LatLng, b: LatLng): number {
  const P = xyKm(p, a), B = xyKm(b, a);
  const dx = B[0] - 0, dy = B[1] - 0;
  const L2 = dx * dx + dy * dy;
  const t = L2 === 0 ? 0.0 : Math.max(0.0, Math.min(1.0, ((P[0] - 0) * dx + (P[1] - 0) * dy) / L2));
  const cx = 0 + t * dx, cy = 0 + t * dy;
  return Math.hypot(P[0] - cx, P[1] - cy);
}

export function distPointPolylineKm(p: LatLng, line: LatLng[]): number {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) best = Math.min(best, distPointSegmentKm(p, line[i]!, line[i + 1]!));
  return best;
}

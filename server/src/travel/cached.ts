// In-memory cache: key = points rounded to 4 dp + 15-min departure bucket + conditions (ARCH §5).
// shortcut: unbounded Map; fine for one demo server, add an LRU bound before real traffic.
import type { TravelProvider } from './provider.js';

const BUCKET_US = 15 * 60_000_000;
const r4 = (x: number) => Math.round(x * 1e4) / 1e4;

export function cached(p: TravelProvider): TravelProvider {
  const memo = new Map<string, Promise<unknown>>();
  const key = (kind: string, points: { lat: number; lng: number }[], dep: number, cond?: object) =>
    JSON.stringify([kind, points.map((q) => [r4(q.lat), r4(q.lng)]), Math.floor(dep / BUCKET_US), cond ?? {}]);
  const once = <T>(k: string, f: () => Promise<T>): Promise<T> => {
    if (!memo.has(k)) memo.set(k, f().catch((e) => { memo.delete(k); throw e; }));   // never cache failures
    return memo.get(k) as Promise<T>;
  };
  return {
    name: p.name,
    getMatrix: (points, dep, cond) => once(key('m', points, dep, cond), () => p.getMatrix(points, dep, cond)),
    getRoute: (points, dep) => once(key('r', points, dep), () => p.getRoute(points, dep)),
  };
}

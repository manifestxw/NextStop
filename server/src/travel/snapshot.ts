// Snapshot source (SPEC §4.2.2): Google data for the seed places, saved once by `npm run snapshot`.
// Demo mode reads only this file: no routing calls on stage. Unknown points fall back to the fixed table.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ammanParts } from '../clock/amman.js';
import { hav } from '../engine/geo.js';
import type { LatLng, Us } from '../engine/types.js';
import { fixedMatrix, type Conditions } from './fixed.js';
import type { Cell, MatrixSpec, TravelProvider } from './provider.js';

export interface Snapshot {
  generatedAt: string; date: string;                 // date = the Sunday the traffic was predicted for
  places: ({ key: string } & LatLng)[];
  buckets: Record<string, Record<string, Cell>>;     // "06:15" → "CC>JUST" → cell
  routes: Record<string, LatLng[]>;                  // "CC>JUST" → road polyline
}

export const SNAPSHOT_FILE = fileURLToPath(new URL('../../../data/demo_snapshot.json', import.meta.url));

export function loadSnapshot(file = SNAPSHOT_FILE): Snapshot | null {
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Snapshot) : null;
}

export function snapshotProvider(snap: Snapshot): TravelProvider {
  const keyOf = (p: LatLng) => snap.places.find((s) => hav(s, p) < 0.05)?.key;   // within 50 m
  const bucketMins = Object.keys(snap.buckets).map((b) => [b, Number(b.slice(0, 2)) * 60 + Number(b.slice(3))] as const);
  // shortcut: departures outside the snapshot window use the nearest bucket; regenerate for other times of day.
  const bucketFor = (t: Us) => {
    const p = ammanParts(t), m = p.hour * 60 + p.minute - ((p.hour * 60 + p.minute) % 15);
    return bucketMins.reduce((best, b) => (Math.abs(b[1] - m) < Math.abs(best[1] - m) ? b : best))[0];
  };
  let warned = false;
  return {
    name: 'snapshot',
    async getMatrix(points, departure, cond: Conditions = {}): Promise<MatrixSpec> {
      const bucket = snap.buckets[bucketFor(departure)]!;
      const keys = points.map(keyOf);
      const cells: Cell[][] = points.map((a, i) => points.map((b, j) => {
        if (i === j || (a.lat === b.lat && a.lng === b.lng)) return { km: 0, minTraffic: 0, minFree: 0 };
        const hit = keys[i] && keys[j] ? bucket[`${keys[i]}>${keys[j]}`] : undefined;
        if (hit) return hit;
        if (!warned) { console.warn('snapshot: a point is not in the snapshot, using the fixed table for it'); warned = true; }
        const f = fixedMatrix([a, b], cond);
        return { km: f.km(0, 1), minTraffic: f.legMin(0, 1, departure), minFree: f.freeMin(0, 1) };
      }));
      return { kind: 'cells', points, cells, cond };
    },
    async getRoute(points) {
      const out: LatLng[] = points.slice(0, 1);
      for (let i = 1; i < points.length; i++) {
        const a = keyOf(points[i - 1]!), b = keyOf(points[i]!);
        const leg = a && b ? snap.routes[`${a}>${b}`] : undefined;
        out.push(...(leg ? leg.slice(1) : [points[i]!]));
      }
      return out;
    },
  };
}

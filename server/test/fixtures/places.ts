// Fixed-table seed coordinates (SPEC §2.6, fare_model.py LOC). Test fixture until seed.json (T4).
import type { LatLng } from '../../src/engine/types.js';

export const LOC = {
  CC: { lat: 32.5568, lng: 35.8469 },
  HS: { lat: 32.552, lng: 35.864 },
  US: { lat: 32.544, lng: 35.857 },
  YU: { lat: 32.5366, lng: 35.8556 },
  AM: { lat: 32.529, lng: 35.866 },
  JUST: { lat: 32.47889, lng: 35.985 },
} satisfies Record<string, LatLng>;
export type Key = keyof typeof LOC;
export const KEYS = Object.keys(LOC) as Key[];

/** Amman local wall time → epoch microseconds (Amman is UTC+3). */
export const amman = (y: number, mo: number, d: number, h: number, mi: number) =>
  Date.UTC(y, mo - 1, d, h - 3, mi) * 1000;
/** Sunday 29 Nov 2026 (demo day), local h:mm. */
export const sun = (h: number, mi: number) => amman(2026, 11, 29, h, mi);

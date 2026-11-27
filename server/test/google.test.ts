// Pure parts of the Google and Snapshot sources (no network in tests).
import { describe, expect, it } from 'vitest';
import { decodePolyline, googleDeparture, cellFrom } from '../src/travel/google.js';
import { snapshotProvider, type Snapshot } from '../src/travel/snapshot.js';
import { toTimed } from '../src/travel/provider.js';
import { amman } from './fixtures/places.js';

describe('Google source helpers', () => {
  it('decodes an encoded polyline (Google reference example)', () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      { lat: 38.5, lng: -120.2 }, { lat: 40.7, lng: -120.95 }, { lat: 43.252, lng: -126.453 },
    ]);
  });

  it('maps a demo time to the next real date with the same Amman weekday and time (traffic needs the future)', () => {
    const realNow = amman(2026, 11, 27, 17, 0);                       // Friday
    expect(new Date(googleDeparture(amman(2026, 11, 29, 6, 10), realNow) / 1000).toISOString()).toBe('2026-11-29T03:10:00.000Z');
    expect(new Date(googleDeparture(amman(2026, 11, 22, 7, 0), realNow) / 1000).toISOString()).toBe('2026-11-29T04:00:00.000Z');  // past Sunday → this Sunday
    expect(new Date(googleDeparture(amman(2026, 11, 27, 9, 0), realNow) / 1000).toISOString()).toBe('2026-12-04T06:00:00.000Z');  // earlier today → next Friday
  });

  it('turns a matrix element into a cell: km to 0.1, never a negative traffic delay', () => {
    expect(cellFrom({ distanceMeters: 18572, duration: '2053s', staticDuration: '1903s' })).toEqual({ km: 18.6, minTraffic: 2053 / 60, minFree: 1903 / 60 });
    expect(cellFrom({ distanceMeters: 1000, duration: '100s', staticDuration: '130s' })).toEqual({ km: 1, minTraffic: 100 / 60, minFree: 100 / 60 });
  });
});

describe('Snapshot source', () => {
  const A = { lat: 32.5, lng: 35.8 }, B = { lat: 32.6, lng: 35.9 };
  const snap: Snapshot = {
    generatedAt: 'x', date: '2026-11-29',
    places: [{ key: 'A', ...A }, { key: 'B', ...B }],
    buckets: {
      '06:00': { 'A>B': { km: 10, minTraffic: 20, minFree: 15 }, 'B>A': { km: 10, minTraffic: 18, minFree: 15 } },
      '06:15': { 'A>B': { km: 10, minTraffic: 30, minFree: 15 }, 'B>A': { km: 10, minTraffic: 19, minFree: 15 } },
    },
    routes: { 'A>B': [A, { lat: 32.55, lng: 35.85 }, B] },
  };
  const p = snapshotProvider(snap);

  it('looks cells up by place and the 15-min bucket of the departure; nearest bucket outside the range', async () => {
    const at = (h: number, m: number) => amman(2026, 11, 29, h, m);
    expect(toTimed(await p.getMatrix([A, B], at(6, 20))).legMin(0, 1, 0)).toBe(30);
    expect(toTimed(await p.getMatrix([A, B], at(6, 0))).legMin(0, 1, 0)).toBe(20);
    expect(toTimed(await p.getMatrix([A, B], at(9, 0))).legMin(0, 1, 0)).toBe(30);
    expect(toTimed(await p.getMatrix([A, A], at(6, 0))).km(0, 1)).toBe(0);
  });

  it('falls back to the fixed table for a point that is not in the snapshot', async () => {
    const C = { lat: 32.52, lng: 35.86 };
    const m = toTimed(await p.getMatrix([A, C], amman(2026, 11, 29, 6, 0)));
    expect(m.km(0, 1)).toBeGreaterThan(0);
  });

  it('routes through stored pair polylines', async () => {
    expect(await p.getRoute([A, B], 0)).toEqual(snap.routes['A>B']);
  });
});

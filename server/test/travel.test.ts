import { describe, expect, it } from 'vitest';
import { LOC, KEYS, sun } from './fixtures/places.js';
import { fixedMatrix, fixedProvider, EXIT } from '../src/travel/fixed.js';
import { toTimed, type MatrixSpec } from '../src/travel/provider.js';
import { cached } from '../src/travel/cached.js';
import { selectProvider } from '../src/travel/select.js';

const pts = KEYS.map((k) => LOC[k]);

describe('TravelProvider', () => {
  it('fixed provider gives a serializable spec that rebuilds the same matrix (fare lock)', async () => {
    const spec = await fixedProvider.getMatrix(pts, sun(7, 0), { level: 'heavy' });
    const again = toTimed(JSON.parse(JSON.stringify(spec)) as MatrixSpec);
    const direct = fixedMatrix(pts, { level: 'heavy' });
    expect(again.km(0, 5)).toBe(direct.km(0, 5));
    expect(again.legMin(0, 5, sun(7, 0))).toBe(direct.legMin(0, 5, sun(7, 0)));
  });

  it('fixed route goes through the exit node for JUST legs only', async () => {
    expect(await fixedProvider.getRoute([LOC.CC, LOC.HS, LOC.JUST], sun(7, 0))).toEqual([LOC.CC, LOC.HS, EXIT, LOC.JUST]);
    expect(await fixedProvider.getRoute([LOC.CC, LOC.AM], sun(7, 0))).toEqual([LOC.CC, LOC.AM]);
  });

  it('cell matrices scale only the traffic delay by the demo multipliers (SPEC §4.3)', () => {
    const cell = { km: 10, minTraffic: 30, minFree: 20 };
    const spec: MatrixSpec = { kind: 'cells', points: [LOC.CC, LOC.US], cells: [[cell, cell], [cell, cell]], cond: { level: 'jam', weather: 'rain' } };
    const m = toTimed(spec);
    expect(m.km(0, 1)).toBe(10);
    expect(m.freeMin(0, 1)).toBe(20);
    expect(m.legMin(0, 1, sun(7, 0))).toBeCloseTo(20 + 10 * 1.5 * 1.15, 9);
  });

  it('cache reuses a result for the same points, 15-min bucket and conditions', async () => {
    let calls = 0;
    const counting = { ...fixedProvider, getMatrix: async (...a: Parameters<typeof fixedProvider.getMatrix>) => { calls++; return fixedProvider.getMatrix(...a); } };
    const c = cached(counting);
    await c.getMatrix(pts, sun(7, 0));
    await c.getMatrix(pts, sun(7, 14));      // same bucket
    await c.getMatrix(pts, sun(7, 15));      // next bucket
    await c.getMatrix(pts, sun(7, 15), { weather: 'rain' });
    expect(calls).toBe(3);
  });

  it('select: fixed works; snapshot/google fall back to fixed until T11', () => {
    expect(selectProvider('fixed').name).toBe('fixed');
    expect(selectProvider('snapshot').name).toBe('fixed');
  });
});

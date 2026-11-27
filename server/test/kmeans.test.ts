// T22 golden values = what docs/reference/fare_model.py prints (SPEC §4.7.1), fixed-table seed coordinates.
import { describe, expect, it } from 'vitest';
import { LOC, sun, amman } from './fixtures/places.js';
import { mulberry32, sampleHistory, kmeans, demandSpots } from '../src/engine/kmeans.js';
import { ammanParts } from '../src/clock/amman.js';
import { pyRound } from '../src/engine/pyRound.js';

describe('k-means demand spots (SPEC §3.18)', () => {
  it('mulberry32 matches the reference (and JS) sequence', () => {
    expect(mulberry32(1)()).toBe(0.6270739405881613);
    const r = mulberry32(2026);
    expect([r(), r(), r()]).toEqual([0.45540769933722913, 0.30849614599719644, 0.6611574492417276]);
  });

  it('sample history: 1,320 points, first one as printed', () => {
    const h = sampleHistory(LOC);
    expect(h.length).toBe(1320);
    const p = ammanParts(h[0]!.at);
    expect([h[0]!.lat.toFixed(5), h[0]!.lng.toFixed(5), p.weekday, p.day, p.hour, p.minute]).toEqual(['32.53403', '35.85801', 0, 1, 7, 49]);
  });

  it('Sun 6:30 from City Center: five spots with the reference counts; best = City Center, inside', () => {
    const { spots, best, inside } = demandSpots(sampleHistory(LOC), LOC.CC, sun(6, 30), LOC);
    // Formatted like Python's f-strings (half-to-even): 97 / 4 = 24.25 prints as 24.2.
    expect(spots.map((s) => [s.area, s.points, s.radiusKm.toFixed(2), pyRound(s.perHour, 1).toFixed(1), s.km.toFixed(1), Math.round(s.min)])).toEqual([
      ['City Center area', 94, '0.70', '23.5', '0.1', 0],
      ['University Street area', 97, '0.60', '24.2', '2.1', 6],
      ['Al-Hashmi area', 71, '0.68', '17.8', '2.3', 6],
      ['Yarmouk area', 100, '0.52', '25.0', '3.2', 9],
      ['Arabella area', 37, '0.67', '9.2', '4.7', 13],
    ]);
    expect([best!.area, inside]).toEqual(['City Center area', true]);
  });

  it('Fri 17:00 from Arabella: one spot, University Street', () => {
    const r = demandSpots(sampleHistory(LOC), LOC.AM, amman(2026, 12, 4, 17, 0), LOC);
    expect([r.spots.length, r.best?.area]).toEqual([1, 'University Street area']);
  });

  it('three obvious blobs → three centres; too few points → no spots', () => {
    const rnd = mulberry32(5);
    const xy = ([[0, 0], [5, 0], [0, 5]] as const).flatMap(([cx, cy]) => Array.from({ length: 20 }, () => [cx + rnd() * 0.2, cy + rnd() * 0.2] as [number, number]));
    const { centers } = kmeans(xy, 3);
    for (const [cx, cy] of [[0.1, 0.1], [5.1, 0.1], [0.1, 5.1]]) expect(Math.min(...centers.map((c) => Math.hypot(c[0] - cx!, c[1] - cy!)))).toBeLessThan(0.2);
    expect(demandSpots([{ lat: 32.55, lng: 35.85, at: sun(6, 40) }], LOC.CC, sun(6, 30), LOC)).toEqual({ spots: [], best: null, inside: false });
  });
});

import { makeHarness, trip, rider, driver } from './helpers.js';

describe('demand spots in the driver view (P2)', () => {
  it('an idle driver gets spots and a best spot (sample data); the demo can move the driver; none during a trip', async () => {
    const h = await makeHarness({ stage: true });
    const omar = await h.login('omar');
    const d = driver(await h.cmd.me(omar)).demand!;
    expect([d.sample, d.spots.length > 0, d.bestIndex !== null]).toEqual([true, true, true]);
    await h.cmd.demo.driverPosition({ driverId: 'u-omar', placeKey: 'HS' });
    const moved = driver(await h.cmd.me(omar)).demand!;
    expect(moved.spots[moved.bestIndex!]!.area).toBe('Al-Hashmi area');
    const lina = await h.login('lina'), id = rider(await h.cmd.createRide(lina, trip('CC'))).ride!.id;
    await h.cmd.findDriver(lina, id); await h.cmd.ready(lina, id, { answer: 'READY' });
    await h.cmd.accept(omar, id);
    expect(driver(await h.cmd.me(omar)).demand).toBeUndefined();
  });
});

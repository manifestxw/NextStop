import { describe, expect, it } from 'vitest';
import { pyRound, up05 } from '../src/engine/pyRound.js';
import { minutesToUs } from '../src/engine/time.js';
import { ammanParts } from '../src/clock/amman.js';

describe('pyRound = Python round() (half-to-even on the exact double)', () => {
  it.each([
    [0.125, 2, 0.12], [0.375, 2, 0.38], [2.5, 0, 2], [3.5, 0, 4], [-2.5, 0, -2],
    [2.675, 2, 2.67],      // 2.675 is really 2.67499999… in binary
    [1.005, 2, 1.0], [0.0, 1, 0], [19.25, 1, 19.2], [19.35, 1, 19.4], [7.8149999, 2, 7.81],
  ])('round(%d, %d) = %d', (x, nd, want) => { expect(pyRound(x, nd)).toBe(want); });

  it('up05 rounds money up to 0.05', () => {
    expect([up05(7.81), up05(9.03 / 4), up05(2.3 * 0.8), up05(4.0), up05(1.0 / 3)]).toEqual([7.85, 2.3, 1.85, 4.0, 0.35]);
  });
});

describe('minutesToUs = Python timedelta(minutes=…) microseconds', () => {
  it('rounds the leftover microsecond half-to-even', () => {
    expect(minutesToUs(1.5)).toBe(90_000_000);
    expect(minutesToUs(0.5)).toBe(30_000_000);
    expect(minutesToUs(16.7)).toBe(1_002_000_000);
    expect(minutesToUs(1 / 3)).toBe(20_000_000);
    expect(minutesToUs(-1.5)).toBe(-90_000_000);
  });
});

describe('ammanParts (Asia/Amman, tests run in TZ=UTC)', () => {
  it('6:10 AM Amman is hour 6, Sunday (weekday 0), even though UTC says 3 AM', () => {
    const us = Date.UTC(2026, 10, 29, 3, 10, 7) * 1000;
    expect(ammanParts(us)).toEqual({ year: 2026, month: 11, day: 29, hour: 6, minute: 10, second: 7, weekday: 0 });
  });
  it('Friday and Saturday are weekday 5 and 6', () => {
    expect(ammanParts(Date.UTC(2026, 11, 4, 12) * 1000).weekday).toBe(5);
    expect(ammanParts(Date.UTC(2026, 11, 5, 12) * 1000).weekday).toBe(6);
  });
  it('crosses midnight in Amman, not UTC', () => {
    expect(ammanParts(Date.UTC(2026, 10, 28, 22, 30) * 1000)).toMatchObject({ day: 29, hour: 1, weekday: 0 });
  });
});

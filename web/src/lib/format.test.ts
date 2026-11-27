import { describe, expect, it } from 'vitest';
import { arriveByIso, countdown, fmtJod, fmtTime, ammanDate } from './format.js';

describe('display formatting (DESIGN §3)', () => {
  it('times are 12-hour Amman wall time, no leading zero', () => {
    expect(fmtTime('2026-11-29T07:02:00.000+03:00')).toBe('7:02 AM');
    expect(fmtTime('2026-11-29T04:30:00.000Z')).toBe('7:30 AM');
  });
  it('money is JOD with 2 decimals', () => {
    expect([fmtJod(2.3), fmtJod(9.03), fmtJod(0)]).toEqual(['JOD 2.30', 'JOD 9.03', 'JOD 0.00']);
  });
  it('countdown is m:ss and never negative', () => {
    expect([countdown(272_000), countdown(59_400), countdown(-5)]).toEqual(['4:32', '1:00', '0:00']);
  });
  it('arrive-by is the Amman date + chosen time; a time already past means tomorrow', () => {
    const now = Date.parse('2026-11-29T06:10:00+03:00');
    expect(ammanDate(now)).toBe('2026-11-29');
    expect(arriveByIso(now, '08:00')).toBe('2026-11-29T08:00:00+03:00');
    expect(arriveByIso(now, '06:00')).toBe('2026-11-30T06:00:00+03:00');
  });
});

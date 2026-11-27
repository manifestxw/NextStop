import type { Us } from './types.js';

export const US_PER_MIN = 60_000_000;
export const US_PER_SEC = 1_000_000;

/** Python timedelta(minutes=m) in microseconds: modf splits, leftover µs rounded half-to-even. */
export function minutesToUs(m: number): Us {
  const ip = Math.trunc(m), fp = m - ip;
  const d = fp * US_PER_MIN;
  const ip2 = Math.trunc(d), fp2 = d - ip2;
  const fl = Math.floor(fp2), diff = fp2 - fl;
  const whole = diff > 0.5 ? fl + 1 : diff < 0.5 ? fl : (fl % 2 === 0 ? fl : fl + 1);
  return ip * US_PER_MIN + ip2 + whole;
}

/** Python (b - a).total_seconds() / 60. */
export const minutesBetween = (a: Us, b: Us): number => (b - a) / US_PER_SEC / 60;

/** Python t.replace(second=0, microsecond=0). Amman's offset is whole hours, so UTC flooring matches. */
export const floorMinute = (t: Us): Us => t - (((t % US_PER_MIN) + US_PER_MIN) % US_PER_MIN);

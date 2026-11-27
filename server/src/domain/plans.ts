// Uni plan calendar (SPEC §3.19): semester end and the dates a weekly pattern produces.
import { ammanParts, fromIso, toIso } from '../clock/amman.js';
import type { Us } from '../engine/types.js';

// [verify with the JUST calendar] Demo semester: 1 Nov 2026 – 31 Jan 2027 (SPEC §2.6).
export const SEMESTER_END = '2027-01-31T23:59:00+03:00';
const DAY_US = 86_400_000_000;

/** Every arrive-by from `fromUs` to `endUs` for weekday (Sun = 0) items at "HH:MM", Amman time. */
export function planDates(pattern: { weekday: number; arriveByTime: string }[], fromUs: Us, endUs: Us): { index: number; arriveBy: string }[] {
  const out: { index: number; arriveBy: string }[] = [];
  for (let d = fromUs - (fromUs % DAY_US); d <= endUs + DAY_US; d += DAY_US) {
    const date = toIso(d + 12 * 3_600_000_000).slice(0, 10);   // midday avoids any date-edge doubt
    const weekday = ammanParts(fromIso(`${date}T12:00:00+03:00`)).weekday;
    pattern.forEach((p, index) => {
      if (p.weekday !== weekday) return;
      const iso = `${date}T${p.arriveByTime}:00+03:00`;
      if (fromIso(iso) >= fromUs && fromIso(iso) <= endUs) out.push({ index, arriveBy: toIso(fromIso(iso)) });
    });
  }
  return out.sort((a, b) => a.arriveBy.localeCompare(b.arriveBy));
}

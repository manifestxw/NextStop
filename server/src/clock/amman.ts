// The ONLY way domain code reads hours, weekdays or dates (AGENTS §7.2). Servers run in UTC.
export interface AmmanParts { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number } // weekday: Sun = 0

const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Amman', hourCycle: 'h23',
  year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
});
const HOUR_MS = 3_600_000;
// Intl is slow and the plan search calls this ~10^5 times, so cache the UTC offset per UTC hour.
// Amman's offset only ever changes on a whole hour, so the cache is exact.
const offsetCache = new Map<number, number>();

export function offsetMs(ms: number): number {
  const key = Math.floor(ms / HOUR_MS);
  let off = offsetCache.get(key);
  if (off === undefined) {
    const p = Object.fromEntries(fmt.formatToParts(new Date(key * HOUR_MS)).map((x) => [x.type, Number(x.value)]));
    off = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!) - key * HOUR_MS;
    offsetCache.set(key, off);
  }
  return off;
}

/** Amman wall-clock parts for an absolute time in epoch microseconds. */
export function ammanParts(us: number): AmmanParts {
  const ms = Math.floor(us / 1000);
  const d = new Date(ms + offsetMs(ms));   // shifted so the UTC getters read Amman wall time
  return {
    year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(),
    hour: d.getUTCHours(), minute: d.getUTCMinutes(), second: d.getUTCSeconds(), weekday: d.getUTCDay(),
  };
}

/** ISO string with the Amman offset, e.g. 2026-11-29T06:10:00.000+03:00 (stored-time format, ARCH §4). */
export function toIso(us: number): string {
  const ms = Math.floor(us / 1000), off = offsetMs(ms);
  const sign = off < 0 ? '-' : '+', a = Math.abs(off) / 60_000;
  const hh = String(Math.floor(a / 60)).padStart(2, '0'), mm = String(a % 60).padStart(2, '0');
  return new Date(ms + off).toISOString().slice(0, 23) + `${sign}${hh}:${mm}`;
}

/** Parse any ISO string with an offset to epoch microseconds. */
export const fromIso = (iso: string): number => Date.parse(iso) * 1000;

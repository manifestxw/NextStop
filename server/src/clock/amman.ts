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

function offsetMs(ms: number): number {
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

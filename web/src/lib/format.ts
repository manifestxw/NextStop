// Display only (DESIGN §3): Amman wall time and JD amounts. No business rules live here.
const timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Amman', hour: 'numeric', minute: '2-digit' });
const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Amman', year: 'numeric', month: '2-digit', day: '2-digit' });

export const fmtTime = (iso: string | number) => timeFmt.format(new Date(iso));
export const fmtJod = (jod: number) => `${jod.toFixed(2)} JD`;   // Jordanian style: "1.70 JD"
export const fmtNum = (jod: number) => jod.toFixed(2);
export const countdown = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));   // round up: 0:00 only when time is really up
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
/** YYYY-MM-DD in Amman for an epoch-ms time. */
export const ammanDate = (ms: number) => dateFmt.format(new Date(ms));

/** The arrive-by a rider picked: today in Amman at hh:mm (+03:00, Jordan has no DST), or tomorrow if that's past. */
export function arriveByIso(nowMs: number, hhmm: string): string {
  const today = `${ammanDate(nowMs)}T${hhmm}:00+03:00`;
  if (Date.parse(today) > nowMs) return today;
  return `${ammanDate(nowMs + 86_400_000)}T${hhmm}:00+03:00`;
}

export const initials = (name: string) => (name.trim()[0] ?? '?').toUpperCase();

// A rider leaves after pickup times froze (SPEC §3.6, §3.10, §4.5; fare_model.py leave).
import { LATE_LEAVE_MIN } from './constants.js';
import { evaluate } from './fare.js';
import { up05 } from './pyRound.js';
import { minutesBetween } from './time.js';
import type { Plan, TimedMatrix, Us } from './types.js';

export interface LeaveResult { fare: number; share: number; charge: number; late: boolean; frozen: Record<number, Us> }

/** Same stop order, same first pickup; the driver waits at early pickups and that wait isn't billed.
 *  nSeats counts riders + their +1s. With one seat left the caller cancels instead (zero result). */
export function leave(
  m: TimedMatrix, p: Pick<Plan, 'stops' | 'T0' | 'pick'>, leaverIdx: number, nSeats: number, lockedShare: number, now: Us,
  { existingCredits = 0.0, driverAssigned = true, priceFactor = 1.0 } = {},
): LeaveResult {
  if (nSeats === 1) return { fare: 0.0, share: 0.0, charge: 0.0, late: false, frozen: {} };
  const remaining = p.stops.filter((s) => s.rider !== leaverIdx);
  const ev = evaluate(m, remaining, p.T0, priceFactor);
  const frozen: Record<number, Us> = {};
  for (const [i, t] of Object.entries(p.pick)) if (+i !== leaverIdx) frozen[+i] = t;
  const n = nSeats - 1;
  const late = driverAssigned && minutesBetween(now, p.T0) < LATE_LEAVE_MIN;
  const charge = late ? lockedShare : 0.0;
  const cashDue = Math.max(0.0, ev.fare - existingCredits - charge);
  let share = up05(cashDue / n);
  if (late) share = Math.min(lockedShare, share);
  return { fare: ev.fare, share, charge, late, frozen };
}

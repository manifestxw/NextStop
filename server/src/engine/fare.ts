import { CALIBRATION, DWELL_DROP, DWELL_PICK, MIN_FARE } from './constants.js';
import { pyRound } from './pyRound.js';
import { tariff } from './tariff.js';
import { minutesBetween, minutesToUs } from './time.js';
import type { Stop, TimedMatrix, Us } from './types.js';

export interface Evaluation { times: Us[]; km: number; wait: number; end: Us; fare: number; dur: number }

/** Drive the stops continuously from T0 (fare_model.py evaluate). Billed wait = Σ(traffic − free) + dwell. */
export function evaluate(m: TimedMatrix, stops: Stop[], T0: Us, priceFactor = 1.0): Evaluation {
  let t = T0, km = 0.0, wait = 0.0, prev = -1;
  const times: Us[] = [];
  for (const s of stops) {
    if (prev >= 0) {
      const mm = m.legMin(prev, s.at, t), f = m.freeMin(prev, s.at);
      km += m.km(prev, s.at);
      wait += mm - f;
      t += minutesToUs(mm);
    }
    times.push(t);
    const d = s.kind === 'P' ? DWELL_PICK : DWELL_DROP;
    wait += d;
    t += minutesToUs(d);
    prev = s.at;
  }
  const tf = tariff(T0);
  const fare = Math.max(MIN_FARE, CALIBRATION * priceFactor * (tf.flag + km * tf.km + wait * tf.wait));
  return { times, km: pyRound(km, 1), wait, end: t, fare: pyRound(fare, 2), dur: minutesBetween(T0, t) };
}

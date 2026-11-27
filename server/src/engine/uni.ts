// Uni plans, pure parts (SPEC §3.19; fare_model.py uni_paid / replacements / cancel_planned).
import { up05 } from './pyRound.js';

export const UNI_PAYS = 0.8;               // a subscriber pays 80% of their share on a uni ride
export const CANCEL_CUTOFF_MIN = 12 * 60;  // ≥ 12 h before: replacement possible; also when rides are placed
export const UNI_RADIUS_KM = 1.0;          // own pickup or destination within 1 km of a campus
export const WEEKLY_PRICE_P = 200;
export const SEMESTER_WEEK_PRICE_P = 160;

export const uniPaid = (share: number) => up05(share * UNI_PAYS);

/** Weekly: 1. Semester: 5% of planned rides, rounded down, minimum 1. */
export const replacementsFor = (kind: 'weekly' | 'semester', planned: number) => (kind === 'weekly' ? 1 : Math.max(1, Math.floor(planned / 20)));

/** ≥ 12 h before: removed, with a replacement if any are left. < 12 h: it's placed; use the normal leave. */
export function cancelOutcome(minutesBefore: number, left: number): ['replacement' | 'gone' | 'use_leave', number] {
  if (minutesBefore < CANCEL_CUTOFF_MIN) return ['use_leave', left];
  return left > 0 ? ['replacement', left - 1] : ['gone', 0];
}

// Demo card only: published test numbers. Nothing is charged; only the last 4 digits are kept.
const TEST_CARDS = new Set(['4242424242424242', '4000056655665556', '5555555555554444', '2223003122003222', '378282246310005']);
export const isTestCard = (n: string) => TEST_CARDS.has(n.replace(/[\s-]/g, ''));

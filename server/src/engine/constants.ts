// Numbers from SPEC §3.5, §3.10, §4 (top of fare_model.py). Don't "improve" them.
// shortcut: CALIBRATION is fixed at 1.00 (golden value); wire it to env CALIBRATION when config lands (T4).
export const CALIBRATION = 1.0;
export const MAX_RIDERS = 4;
export const BUFFER = 5;              // rule 7: drop by effective arrive-by − 5 min
export const EARLY_MAX = 25;          // rule 7 default (Economy)
export const PICKUP_SHIFT_MAX = 15;   // rule 9
export const MIN_LEAD_TO_JOIN = 45;   // rule 11
export const LATE_LEAVE_MIN = 30;     // §3.10
export const DWELL_PICK = 1.5;
export const DWELL_DROP = 0.5;
export const MIN_FARE = 1.0;
export const DAY = { flag: 0.468, km: 0.336, wait: 0.0576 };
export const NIGHT = { flag: 0.48, km: 0.396, wait: 0.0679 };

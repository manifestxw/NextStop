// The one server-side demo clock (ARCH §8). Every rule reads clock.now(). Paused by default in demo mode.
// Stepped fast-forward (walk due events in order) is the scheduler's job, added with the domain (T6).
import type { Us } from '../engine/types.js';

export interface ClockOptions { startUs: Us; paused: boolean; realNowMs?: () => number }

export function createClock({ startUs, paused, realNowMs = () => Date.now() }: ClockOptions) {
  let base = startUs, realBase = realNowMs(), isPaused = paused;
  const now = (): Us => (isPaused ? base : base + (realNowMs() - realBase) * 1000);
  return {
    now,
    advance(min: number) { base = now() + min * 60_000_000; realBase = realNowMs(); },
    jump(us: Us) { base = us; realBase = realNowMs(); },
    setPaused(p: boolean) { base = now(); realBase = realNowMs(); isPaused = p; },
    snapshot: () => ({ nowUs: now(), paused: isPaused }),
  };
}
export type Clock = ReturnType<typeof createClock>;

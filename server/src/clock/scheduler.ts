// Scheduler tick every 1 s inside the write lock (ARCH §8). Due ride events plug in via `onTick` (T6);
// every tick also saves the clock so a restart resumes at the same demo time.
import { toIso } from './amman.js';
import type { Clock } from './clock.js';
import type { Us } from '../engine/types.js';
import type { Repo, Store } from '../store/repo.js';

export interface SchedulerOptions {
  store: Store; clock: Clock;
  onTick?: (repo: Repo, now: Us) => Promise<void>;
  intervalMs?: number;
}

export function createScheduler({ store, clock, onTick, intervalMs = 1000 }: SchedulerOptions) {
  let timer: NodeJS.Timeout | undefined, running = false;
  const tickOnce = () => store.withLock(async (repo) => {
    const now = clock.now();
    if (onTick) await onTick(repo, now);
    const demo = await repo.getDemoState();
    if (demo) await repo.putDemoState({ ...demo, nowIso: toIso(clock.now()), paused: clock.snapshot().paused });
  });
  return {
    tickOnce,
    start() {
      timer ??= setInterval(() => {
        if (running) return;   // a slow tick never overlaps the next one
        running = true;
        tickOnce().catch((e) => console.error('scheduler tick failed:', e)).finally(() => { running = false; });
      }, intervalMs);
    },
    stop() { clearInterval(timer); timer = undefined; },
  };
}

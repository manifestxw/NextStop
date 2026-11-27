import { describe, expect, it } from 'vitest';
import { createClock } from '../src/clock/clock.js';
import { toIso, fromIso } from '../src/clock/amman.js';
import { sun } from './fixtures/places.js';

const MIN = 60_000_000;

describe('demo clock (ARCH §8)', () => {
  it('stays still while paused, however much real time passes', () => {
    let real = 1_000;
    const c = createClock({ startUs: sun(6, 10), paused: true, realNowMs: () => real });
    real += 3_600_000;
    expect(c.now()).toBe(sun(6, 10));
  });

  it('runs with real time once resumed, and pausing freezes the current time', () => {
    let real = 0;
    const c = createClock({ startUs: sun(6, 10), paused: true, realNowMs: () => real });
    c.setPaused(false);
    real += 90_000;                                // 1.5 min
    expect(c.now()).toBe(sun(6, 10) + 1.5 * MIN);
    c.setPaused(true);
    real += 600_000;
    expect(c.now()).toBe(sun(6, 10) + 1.5 * MIN);
  });

  it('advance and jump move the base time', () => {
    const c = createClock({ startUs: sun(6, 10), paused: true, realNowMs: () => 0 });
    c.advance(25);
    expect(c.now()).toBe(sun(6, 35));
    c.jump(sun(7, 0));
    expect(c.snapshot()).toEqual({ nowUs: sun(7, 0), paused: true });
  });
});

describe('ISO with the Amman offset', () => {
  it('writes +03:00 wall time and reads it back', () => {
    expect(toIso(sun(6, 10))).toBe('2026-11-29T06:10:00.000+03:00');
    expect(fromIso('2026-11-29T06:10:00+03:00')).toBe(sun(6, 10));
    expect(fromIso(toIso(sun(7, 2) + 123_000))).toBe(sun(7, 2) + 123_000);
  });
});

import { createScheduler } from '../src/clock/scheduler.js';
import { createMemoryStore } from '../src/store/memoryRepo.js';
import { seedIfEmpty } from '../src/store/seed.js';
import { parseConfig } from '../src/config.js';

describe('scheduler tick', () => {
  it('runs the due-event hook under the lock and saves the clock every tick', async () => {
    const store = createMemoryStore();
    await store.withLock((r) => seedIfEmpty(r, parseConfig({})));
    const clock = createClock({ startUs: sun(6, 10), paused: true, realNowMs: () => 0 });
    const seen: number[] = [];
    const s = createScheduler({ store, clock, onTick: async (_r, now) => { seen.push(now); } });
    clock.advance(25);
    await s.tickOnce();
    expect(seen).toEqual([sun(6, 35)]);
    expect(await store.withLock((r) => r.getDemoState())).toMatchObject({ nowIso: '2026-11-29T06:35:00.000+03:00', paused: true });
  });
});

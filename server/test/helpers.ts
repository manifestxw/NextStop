// Test harness: seeded memory store, paused clock at Sun 6:10, fixed travel data, recording publisher.
import { createClock } from '../src/clock/clock.js';
import { createCommands, type Ctx } from '../src/commands/index.js';
import { parseConfig } from '../src/config.js';
import { createMemoryStore } from '../src/store/memoryRepo.js';
import { seedIfEmpty } from '../src/store/seed.js';
import type { Publisher } from '../src/realtime/publisher.js';
import type { ChatMessageView, RiderView, DriverView, View } from '@nextstop/shared';
import { sun, LOC } from './fixtures/places.js';
import { loadSeed } from '../src/store/seed.js';

/** `stage: true` = the demo as it runs on stage: Snapshot source and seed.json's Google places. */
export async function makeHarness({ stage = false } = {}) {
  const cfg = parseConfig({ TRAVEL_SOURCE: stage ? 'snapshot' : 'fixed' });
  const store = createMemoryStore();
  await store.withLock((r) => seedIfEmpty(r, cfg));
  const real = { ms: 1_000_000 };
  const clock = createClock({ startUs: sun(6, 10), paused: true, realNowMs: () => real.ms });
  const pushed: { userId: string; view: View }[] = [];
  const chats: { userId: string; msg: ChatMessageView }[] = [];
  const publisher: Publisher = {
    view: (userId, view) => { pushed.push({ userId, view }); },
    chat: (userId, msg) => { chats.push({ userId, msg }); },
    clock: () => undefined,
    logout: () => undefined,
  };
  // Fixed-table coordinates (SPEC §2.6), not seed.json's Google points: these tests check the engine's golden numbers.
  const places = stage ? loadSeed().places : loadSeed().places.map((p) => ({ ...p, ...LOC[p.key as keyof typeof LOC] }));
  const ctx: Ctx = { store, clock, cfg, publisher, realNowMs: () => real.ms, places };
  const cmd = createCommands(ctx);
  const login = async (as: 'laith' | 'saed' | 'yazeed' | 'noor' | 'huda' | 'lina' | 'sara') => (await cmd.demoLogin({ as })).token;
  return { cfg, store, clock, real, pushed, chats, ctx, cmd, login };
}

export const trip = (pickup: string, by = '2026-11-29T08:00:00+03:00', extra: object = {}) =>
  ({ pickup: { key: pickup }, dest: { key: 'JUST' }, arriveBy: by, category: 'economy' as const, sameGenderOnly: true, ...extra });

export const rider = (v: View) => v as RiderView;
export const driver = (v: View) => v as DriverView;
export const hhmm = (iso: string) => iso.slice(11, 16);

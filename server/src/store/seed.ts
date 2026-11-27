// Seed data (SPEC §2.6): places, demo accounts, Omar, simulated riders. Boot seeds an empty DB;
// the demo menu's Reset wipes everything, bumps the epoch (logs every phone out) and reloads.
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { toIso } from '../clock/amman.js';
import type { Config } from '../config.js';
import type { Place, User } from '../domain/types.js';
import { planDates, SEMESTER_END } from '../domain/plans.js';
import { fromIso } from '../clock/amman.js';
import { replacementsFor, SEMESTER_WEEK_PRICE_P } from '../engine/uni.js';
import type { Repo } from './repo.js';

interface SeedFile {
  places: (Omit<Place, 'placeId'> & { key: string; placeId: string | null })[];
  users: Pick<User, 'id' | 'firstName' | 'lastName' | 'gender' | 'role' | 'seedLogin' | 'friendCode' | 'isSim' | 'phone'>[];
  drivers: { userId: string; car: string; plate: string; baseKey: string }[];
  simRiders: { userId: string; pickupKey: string; destKey: string; arriveBy: string; chatLine: string }[];
}

// Same relative path from src/store/ (dev) and dist/store/ (prod).
const SEED_FILE = fileURLToPath(new URL('../../../data/seed.json', import.meta.url));

export function loadSeed() {
  const s = JSON.parse(readFileSync(SEED_FILE, 'utf8')) as SeedFile;
  const places: Place[] = s.places.map(({ placeId, ...p }) => (placeId ? { ...p, placeId } : p));
  return { ...s, places };
}

export const placeByKey = (key: string): Place | undefined => loadSeed().places.find((p) => p.key === key);

/** Simulated riders in the order "Simulate rider" tries them (SPEC §2.6). */
export const SIM_ORDER = (() => {
  const s = loadSeed();
  return s.simRiders.map((r) => ({ ...r, firstName: s.users.find((u) => u.id === r.userId)!.firstName }));
})();

const newToken = () => randomBytes(16).toString('hex');   // 128-bit

async function load(repo: Repo, cfg: Config, epoch: number, paused: boolean) {
  const s = loadSeed();
  const createdAt = toIso(cfg.demoStartUs);
  for (const u of s.users) {
    await repo.putUser({ ...u, token: newToken(), epoch, sameGenderOnly: true, viewSeq: 0, outstandingP: 0, createdAt });
  }
  for (const d of s.drivers) {
    const base = s.places.find((p) => p.key === d.baseKey)!;
    await repo.putDriver({ userId: d.userId, car: d.car, plate: d.plate, base, creditBalanceP: 0, rejectedRideIds: [] });
  }
  // Huda's semester Uni plan: Arabella → JUST, Mon–Thu, arrive 8:00 (SPEC §2.6). No Sunday ride, so the demo stays clean.
  const am = s.places.find((p) => p.key === 'AM')!, just = s.places.find((p) => p.key === 'JUST')!;
  const dates = planDates([1, 2, 3, 4].map((weekday) => ({ weekday, arriveByTime: '08:00' })), cfg.demoStartUs + 12 * 3_600_000_000, fromIso(SEMESTER_END));
  const weeks = Math.ceil((fromIso(SEMESTER_END) - cfg.demoStartUs) / (7 * 86_400_000_000));
  await repo.putSubscription({ id: 'sub-huda', userId: 'u-huda', kind: 'semester', start: createdAt, end: SEMESTER_END,
    pricePaidP: SEMESTER_WEEK_PRICE_P * weeks, card: { brand: 'demo', last4: '4242' }, replacementsLeft: replacementsFor('semester', dates.length), replacementCredits: 0 });
  for (const [i, d] of dates.entries()) {
    await repo.putPlannedTrip({ id: `pt-huda-${i}`, subscriptionId: 'sub-huda', userId: 'u-huda', pickup: am, dest: just, arriveBy: d.arriveBy,
      category: 'economy', sameGenderOnly: true, state: 'PLANNED', isReplacement: false });
  }
  await repo.putDemoState({
    epoch, nowIso: createdAt, paused,
    settings: { source: cfg.travelSource, offlineFallbackActive: false, traffic: 'normal', weather: 'clear', driversNearby: 20, simAutoReady: true },
  });
}

/** Boot: seed only if the DB has never been seeded. Returns whether it seeded. */
export async function seedIfEmpty(repo: Repo, cfg: Config): Promise<boolean> {
  if (await repo.getDemoState()) return false;
  await load(repo, cfg, 1, cfg.clockStartPaused);
  return true;
}

/** Demo reset: wipe every table, reload, epoch + 1, clock back to the start and paused. Returns the new epoch. */
export async function resetToSeed(repo: Repo, cfg: Config): Promise<number> {
  const epoch = ((await repo.getDemoState())?.epoch ?? 0) + 1;
  await repo.wipe();
  await load(repo, cfg, epoch, true);
  return epoch;
}

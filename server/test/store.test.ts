// One contract, two repos (ARCH §12): memoryRepo for domain tests, prismaRepo for the app.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { createMemoryStore } from '../src/store/memoryRepo.js';
import { createPrismaStore } from '../src/store/prismaRepo.js';
import type { Store } from '../src/store/repo.js';
import type { Ride, User } from '../src/domain/types.js';

const user = (id: string, extra: Partial<User> = {}): User => ({
  id, token: `t-${id}`, epoch: 1, role: 'rider', firstName: id, gender: 'F', sameGenderOnly: true,
  friendCode: `${id.toUpperCase().padEnd(6, 'X').slice(0, 6)}`, viewSeq: 0, outstandingP: 0, isSim: false,
  createdAt: '2026-11-29T06:00:00.000+03:00', ...extra,
});
const place = { key: 'CC', name: 'Irbid City Center', area: 'City Center area', lat: 32.5568, lng: 35.8469 };
const ride = (id: string, state: Ride['state'], memberIds: string[]): Ride => ({
  id, version: 0, state, hostUserId: memberIds[0]!, gender: 'F', category: 'economy', genderMode: 'same',
  zone: { pickupKm: 1.5, destKm: 1.0 },
  anchor: { pickup: place, dest: { ...place, key: 'JUST' }, arriveBy: '2026-11-29T08:00:00.000+03:00', route: [place], km: 19.3 },
  members: memberIds.map((u) => ({
    userId: u, pickup: place, dest: place, arriveBy: '2026-11-29T08:00:00.000+03:00', joinedAt: '2026-11-29T06:10:00.000+03:00',
    state: 'JOINED', firstShownPickup: '2026-11-29T07:15:00.000+03:00', shownPickup: '2026-11-29T07:15:00.000+03:00',
    soloFareP: 785, soloInCarMin: 38.5, guest: u === 'saed' ? { firstName: 'Maya', gender: 'F' } : undefined,
  })),
  plan: { stops: [], firstPickup: '2026-11-29T07:15:00.000+03:00', km: 19.3, durMin: 40, fareJod: 7.81, shareP: 785, inCarMin: {} },
  creditsP: 0, createdAt: '2026-11-29T06:10:00.000+03:00',
});

const dir = mkdtempSync(join(tmpdir(), 'ridesync-store-'));
const dbUrl = `file:${join(dir, 'test.db')}`;
const schema = fileURLToPath(new URL('../prisma/schema.prisma', import.meta.url));
let prisma: PrismaClient;

beforeAll(() => {
  execSync(`npx prisma db push --skip-generate --schema "${schema}"`, { env: { ...process.env, DATABASE_URL: dbUrl }, stdio: 'ignore' });
  prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
}, 60_000);
afterAll(async () => { await prisma?.$disconnect(); rmSync(dir, { recursive: true, force: true }); });

const stores: [string, () => Store][] = [
  ['memoryRepo', () => createMemoryStore()],
  ['prismaRepo', () => createPrismaStore(prisma)],
];

describe.each(stores)('%s contract', (_name, make) => {
  let store: Store;
  beforeAll(async () => { store = make(); await store.withLock((r) => r.wipe()); });

  it('round-trips users and finds them by token, seed login and friend code', async () => {
    await store.withLock(async (r) => { await r.putUser(user('laith', { seedLogin: 'laith', friendCode: 'LAIT26' })); });
    await store.withLock(async (r) => {
      expect((await r.getUserByToken('t-laith'))?.id).toBe('laith');
      expect((await r.getUserBySeedLogin('laith'))?.id).toBe('laith');
      expect((await r.getUserByFriendCode('LAIT26'))?.id).toBe('laith');
      expect(await r.getUser('nobody')).toBeNull();
      await r.putUser({ ...user('laith', { seedLogin: 'laith', friendCode: 'LAIT26' }), viewSeq: 7 });
      expect((await r.getUser('laith'))?.viewSeq).toBe(7);
    });
  });

  it('round-trips a ride with members exactly, and lists active and per-user rides', async () => {
    await store.withLock(async (r) => {
      await r.putUser(user('saed'));
      await r.putRide(ride('r1', 'OPEN', ['laith', 'saed']));
      await r.putRide(ride('r2', 'COMPLETED', ['laith']));
    });
    await store.withLock(async (r) => {
      expect(await r.getRide('r1')).toEqual(ride('r1', 'OPEN', ['laith', 'saed']));
      expect((await r.listActiveRides()).map((x) => x.id)).toEqual(['r1']);
      expect((await r.listRidesForUser('laith')).map((x) => x.id).sort()).toEqual(['r1', 'r2']);
      await r.putUser(user('yazeed', { role: 'driver' }));
      await r.putRide({ ...ride('r2', 'COMPLETED', ['laith']), driverUserId: 'yazeed' });
      expect((await r.listRidesByDriver('yazeed')).map((x) => x.id)).toEqual(['r2']);
      const one = ride('r1', 'READY_CHECK', ['laith']);
      await r.putRide({ ...one, version: 1 });     // members are replaced, not merged
      expect((await r.getRide('r1'))?.members.map((m) => m.userId)).toEqual(['laith']);
    });
  });

  it('numbers chat messages per ride and returns the last N oldest-first', async () => {
    await store.withLock(async (r) => {
      for (let i = 1; i <= 5; i++) await r.addMessage({ id: `m${i}`, rideId: 'r1', channel: 'group', kind: 'user', fromUserId: 'laith', text: `hi ${i}`, at: `2026-11-29T06:1${i}:00.000+03:00` });
      await r.addMessage({ id: 'd1', rideId: 'r1', channel: 'driver:laith', kind: 'user', text: 'x', at: '2026-11-29T06:20:00.000+03:00' });
    });
    await store.withLock(async (r) => {
      const last = await r.listMessages('r1', 'group', 3);
      expect(last.map((m) => [m.seq, m.text])).toEqual([[3, 'hi 3'], [4, 'hi 4'], [5, 'hi 5']]);
      expect((await r.listMessages('r1', 'driver:laith')).map((m) => m.seq)).toEqual([6]);
      await r.deleteMessages('r1');
      expect(await r.listMessages('r1', 'group')).toEqual([]);
    });
  });

  it('keeps banners until seen, and demo state', async () => {
    await store.withLock(async (r) => {
      await r.addBanner({ id: 'b1', userId: 'laith', text: 'Saed left the ride', tone: 'info', at: '2026-11-29T06:30:00.000+03:00', seen: false });
      expect((await r.listUnseenBanners('laith')).map((b) => b.id)).toEqual(['b1']);
      await r.markBannerSeen('b1');
      expect(await r.listUnseenBanners('laith')).toEqual([]);
      const s = { epoch: 2, nowIso: '2026-11-29T06:10:00.000+03:00', paused: true,
        settings: { source: 'snapshot', offlineFallbackActive: false, traffic: 'normal', weather: 'clear', driversNearby: 8, simAutoReady: true } } as const;
      await r.putDemoState(s);
      expect(await r.getDemoState()).toEqual(s);
    });
  });

  it('keeps one invite per ride and invitee, and expires pending ones', async () => {
    await store.withLock(async (r) => {
      const base = { rideId: 'r1', fromUserId: 'laith', toUserId: 'saed', state: 'PENDING' as const };
      await r.putInvite({ ...base, id: 'i1', at: '2026-11-29T06:10:00.000+03:00' });
      await r.putInvite({ ...base, id: 'i2', at: '2026-11-29T06:11:00.000+03:00' });   // replaces i1
      expect((await r.listInvitesForUser('saed')).map((i) => i.id)).toEqual(['i2']);
      await r.expireInvites('r1');
      expect((await r.getInvite('i2'))?.state).toBe('EXPIRED');
      expect((await r.listInvitesForRide('r1')).length).toBe(1);
    });
  });

  it('rolls back everything when a locked block throws', async () => {
    await expect(store.withLock(async (r) => { await r.putUser(user('ghost')); throw new Error('boom'); })).rejects.toThrow('boom');
    expect(await store.withLock((r) => r.getUser('ghost'))).toBeNull();
  });

  it('serializes commits: two read-modify-writes never lose an update (last-seat race)', async () => {
    const bump = () => store.withLock(async (r) => {
      const u = (await r.getUser('laith'))!;
      await new Promise((ok) => setTimeout(ok, 10));   // yield mid-commit
      await r.putUser({ ...u, viewSeq: u.viewSeq + 1 });
    });
    const before = (await store.withLock((r) => r.getUser('laith')))!.viewSeq;
    await Promise.all([bump(), bump(), bump()]);
    expect((await store.withLock((r) => r.getUser('laith')))!.viewSeq).toBe(before + 3);
  });

  it('wipe clears every table', async () => {
    await store.withLock((r) => r.wipe());
    await store.withLock(async (r) => {
      expect([await r.listUsers(), await r.listActiveRides(), await r.getDemoState()]).toEqual([[], [], null]);
    });
  });
});

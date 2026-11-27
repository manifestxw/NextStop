// SQLite Repo via Prisma (ARCH §4.1). Nested objects are JSON strings; the only raw storage detail
// beyond ARCH is Member.pos, which keeps member order (host first) when joins share a timestamp.
import type { Prisma, PrismaClient } from '@prisma/client';
import { ACTIVE_STATES, type Invite, type Member, type Ride, type User } from '../domain/types.js';
import { createLock } from './lock.js';
import type { Repo, Store } from './repo.js';

type Tx = Prisma.TransactionClient;
type RideRow = Prisma.RideGetPayload<{ include: { members: true } }>;
type MemberRow = RideRow['members'][number];

const j = (v: unknown) => (v === undefined ? null : JSON.stringify(v));
const p = <T>(v: string | null): T | undefined => (v === null ? undefined : (JSON.parse(v) as T));
const opt = <T>(v: T | null): T | undefined => (v === null ? undefined : v);

const toUser = (u: Prisma.UserGetPayload<object>): User => ({
  id: u.id, token: u.token, epoch: u.epoch, role: u.role as User['role'], firstName: u.firstName, gender: u.gender as User['gender'],
  sameGenderOnly: u.sameGenderOnly, friendCode: u.friendCode, viewSeq: u.viewSeq, outstandingP: u.outstandingP,
  isSim: u.isSim, seedLogin: opt(u.seedLogin) as User['seedLogin'], createdAt: u.createdAt,
});

const toMember = (m: MemberRow): Member => ({
  userId: m.userId, pickup: JSON.parse(m.pickupJson), dest: JSON.parse(m.destJson), arriveBy: m.arriveBy,
  joinedAt: m.joinedAt, state: m.state as Member['state'], firstShownPickup: m.firstShownPickup, shownPickup: m.shownPickup,
  soloFareP: m.soloFareP, soloInCarMin: m.soloInCarMin, readyAnswer: opt(m.readyAnswer) as Member['readyAnswer'],
  guest: p(m.guestJson), invitedBy: opt(m.invitedBy), uniDiscount: m.uniDiscount || undefined,
  plannedTripId: opt(m.plannedTripId), leave: p(m.leaveJson),
});

const toRide = (r: RideRow): Ride => ({
  id: r.id, version: r.version, state: r.state as Ride['state'], hostUserId: r.hostUserId, gender: r.gender as Ride['gender'],
  category: r.category as Ride['category'], genderMode: r.genderMode as Ride['genderMode'], zone: JSON.parse(r.zoneJson),
  anchor: JSON.parse(r.anchorJson), members: [...r.members].sort((a, b) => a.pos - b.pos).map(toMember),
  plan: JSON.parse(r.planJson), frozen: r.frozenAt === null ? undefined : { at: r.frozenAt }, locked: p(r.lockedJson),
  creditsP: r.creditsP, readyCheck: p(r.readyCheckJson), dispatch: p(r.dispatchJson), driverUserId: opt(r.driverUserId),
  summary: p(r.summaryJson), cancelReason: opt(r.cancelReason) as Ride['cancelReason'], createdAt: r.createdAt, closedAt: opt(r.closedAt),
});

function repoFor(tx: Tx): Repo {
  const withMembers = { include: { members: true } } as const;
  return {
    getUser: async (id) => { const u = await tx.user.findUnique({ where: { id } }); return u && toUser(u); },
    getUserByToken: async (token) => { const u = await tx.user.findUnique({ where: { token } }); return u && toUser(u); },
    getUserBySeedLogin: async (seedLogin) => { const u = await tx.user.findUnique({ where: { seedLogin } }); return u && toUser(u); },
    getUserByFriendCode: async (friendCode) => { const u = await tx.user.findUnique({ where: { friendCode } }); return u && toUser(u); },
    listUsers: async () => (await tx.user.findMany({ orderBy: { createdAt: 'asc' } })).map(toUser),
    putUser: async (u) => {
      const data = { ...u, seedLogin: u.seedLogin ?? null };
      await tx.user.upsert({ where: { id: u.id }, create: data, update: data });
    },
    getDriver: async (userId) => {
      const d = await tx.driver.findUnique({ where: { userId } });
      return d && { userId: d.userId, car: d.car, plate: d.plate, base: JSON.parse(d.baseJson), position: p(d.positionJson),
        creditBalanceP: d.creditBalanceP, rejectedRideIds: JSON.parse(d.rejectedRideIds) };
    },
    listDrivers: async () => {
      const ds = await tx.driver.findMany();
      return ds.map((d) => ({ userId: d.userId, car: d.car, plate: d.plate, base: JSON.parse(d.baseJson), position: p(d.positionJson),
        creditBalanceP: d.creditBalanceP, rejectedRideIds: JSON.parse(d.rejectedRideIds) as string[] }));
    },
    putDriver: async (d) => {
      const data = { car: d.car, plate: d.plate, baseJson: JSON.stringify(d.base), positionJson: j(d.position),
        creditBalanceP: d.creditBalanceP, rejectedRideIds: JSON.stringify(d.rejectedRideIds) };
      await tx.driver.upsert({ where: { userId: d.userId }, create: { userId: d.userId, ...data }, update: data });
    },
    getRide: async (id) => { const r = await tx.ride.findUnique({ where: { id }, ...withMembers }); return r && toRide(r); },
    listActiveRides: async () => (await tx.ride.findMany({ where: { state: { in: ACTIVE_STATES } }, orderBy: { createdAt: 'asc' }, ...withMembers })).map(toRide),
    listRidesForUser: async (userId) => (await tx.ride.findMany({ where: { members: { some: { userId } } }, orderBy: { createdAt: 'asc' }, ...withMembers })).map(toRide),
    listRidesByDriver: async (driverUserId) => (await tx.ride.findMany({ where: { driverUserId }, orderBy: { createdAt: 'asc' }, ...withMembers })).map(toRide),
    putRide: async (r) => {
      const data = {
        version: r.version, state: r.state, hostUserId: r.hostUserId, gender: r.gender, category: r.category, genderMode: r.genderMode,
        zoneJson: JSON.stringify(r.zone), anchorJson: JSON.stringify(r.anchor), planJson: JSON.stringify(r.plan),
        frozenAt: r.frozen?.at ?? null, lockedJson: j(r.locked), creditsP: r.creditsP, readyCheckJson: j(r.readyCheck),
        dispatchJson: j(r.dispatch), driverUserId: r.driverUserId ?? null, summaryJson: j(r.summary), cancelReason: r.cancelReason ?? null,
        createdAt: r.createdAt, closedAt: r.closedAt ?? null,
      };
      await tx.ride.upsert({ where: { id: r.id }, create: { id: r.id, ...data }, update: data });
      await tx.member.deleteMany({ where: { rideId: r.id } });
      await tx.member.createMany({
        data: r.members.map((m, pos) => ({
          rideId: r.id, userId: m.userId, pos, pickupJson: JSON.stringify(m.pickup), destJson: JSON.stringify(m.dest),
          arriveBy: m.arriveBy, joinedAt: m.joinedAt, state: m.state, firstShownPickup: m.firstShownPickup, shownPickup: m.shownPickup,
          soloFareP: m.soloFareP, soloInCarMin: m.soloInCarMin, readyAnswer: m.readyAnswer ?? null, guestJson: j(m.guest),
          uniDiscount: m.uniDiscount ?? false, plannedTripId: m.plannedTripId ?? null, invitedBy: m.invitedBy ?? null, leaveJson: j(m.leave),
        })),
      });
    },
    addMessage: async (m) => {
      const last = await tx.chatMessage.aggregate({ where: { rideId: m.rideId }, _max: { seq: true } });
      const row = await tx.chatMessage.create({ data: { ...m, fromUserId: m.fromUserId ?? null, seq: (last._max.seq ?? 0) + 1 } });
      return { ...row, channel: row.channel as Parameters<Repo['addMessage']>[0]['channel'], kind: row.kind as 'user' | 'system', fromUserId: opt(row.fromUserId) };
    },
    listMessages: async (rideId, channel, limit = 100) => {
      const rows = await tx.chatMessage.findMany({ where: { rideId, channel }, orderBy: { seq: 'desc' }, take: limit });
      return rows.reverse().map((r) => ({ ...r, channel: r.channel as typeof channel, kind: r.kind as 'user' | 'system', fromUserId: opt(r.fromUserId) }));
    },
    deleteMessages: async (rideId) => { await tx.chatMessage.deleteMany({ where: { rideId } }); },
    addBanner: async (b) => { await tx.banner.create({ data: b }); },
    listUnseenBanners: async (userId) =>
      (await tx.banner.findMany({ where: { userId, seen: false }, orderBy: { at: 'asc' } })).map((b) => ({ ...b, tone: b.tone as 'info' | 'warn' | 'danger' })),
    markBannerSeen: async (id) => { await tx.banner.updateMany({ where: { id }, data: { seen: true } }); },
    putInvite: async (i) => {
      await tx.invite.deleteMany({ where: { rideId: i.rideId, toUserId: i.toUserId, NOT: { id: i.id } } });
      await tx.invite.upsert({ where: { id: i.id }, create: i, update: i });
    },
    getInvite: async (id) => (await tx.invite.findUnique({ where: { id } })) as Invite | null,
    listInvitesForUser: async (toUserId) => (await tx.invite.findMany({ where: { toUserId }, orderBy: { at: 'asc' } })) as Invite[],
    listInvitesForRide: async (rideId) => (await tx.invite.findMany({ where: { rideId }, orderBy: { at: 'asc' } })) as Invite[],
    expireInvites: async (rideId) => { await tx.invite.updateMany({ where: { rideId, state: 'PENDING' }, data: { state: 'EXPIRED' } }); },
    getDemoState: async () => {
      const d = await tx.demoState.findUnique({ where: { id: 1 } });
      return d && { epoch: d.epoch, nowIso: d.demoNowIso, paused: d.paused, settings: JSON.parse(d.settingsJson) };
    },
    putDemoState: async (d) => {
      const data = { epoch: d.epoch, demoNowIso: d.nowIso, paused: d.paused, settingsJson: JSON.stringify(d.settings) };
      await tx.demoState.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
    },
    wipe: async () => {
      for (const t of ['chatMessage', 'member', 'ride', 'driver', 'banner', 'invite', 'plannedTrip', 'subscription', 'demandPoint', 'demoState', 'user'] as const) {
        await (tx[t] as unknown as { deleteMany(): Promise<unknown> }).deleteMany();
      }
    },
  };
}

export function createPrismaStore(prisma: PrismaClient): Store {
  const lock = createLock();
  return {
    withLock: (fn) => lock(() => prisma.$transaction((tx) => fn(repoFor(tx)), { maxWait: 15_000, timeout: 15_000 })),
    close: () => prisma.$disconnect(),
  };
}

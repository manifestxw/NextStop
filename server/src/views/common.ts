import type { BannerView, ChatMessageView, ClockView, SeatView } from '@nextstop/shared';
import { toIso } from '../clock/amman.js';
import type { Clock } from '../clock/clock.js';
import { activeMembers } from '../domain/bridge.js';
import type { Banner, ChatMessage, Ride, User } from '../domain/types.js';

export const initials = (name: string) => (name.trim()[0] ?? '?').toUpperCase();
export const clockView = (clock: Clock): ClockView => ({ nowIso: toIso(clock.now()), paused: clock.snapshot().paused });
export const bannerView = (b: Banner): BannerView => ({ id: b.id, text: b.text, tone: b.tone, at: b.at });

export function chatView(m: ChatMessage, users: Map<string, User>): ChatMessageView {
  return { id: m.id, rideId: m.rideId, seq: m.seq, channel: m.channel, kind: m.kind, text: m.text, at: m.at,
    ...(m.fromUserId ? { fromUserId: m.fromUserId, fromFirstName: users.get(m.fromUserId)?.firstName } : {}) };
}

/** Seat meter: first names and initials only (SPEC §3.14). A +1 takes its own seat. */
export function seatViews(ride: Ride, meId: string | null, users: Map<string, User>): SeatView[] {
  const status = (m: Ride['members'][number]): SeatView['ready'] =>
    ride.state !== 'READY_CHECK' ? undefined : m.readyAnswer === 'READY' ? 'READY' : 'WAITING';
  return activeMembers(ride).flatMap((m) => {
    const name = users.get(m.userId)?.firstName ?? '?';
    const seat: SeatView = { initials: initials(name), firstName: name, isMe: m.userId === meId, isHost: m.userId === ride.hostUserId,
      ...(status(m) ? { ready: status(m) } : {}) };
    return m.guest && !m.guest.leave
      ? [seat, { initials: initials(m.guest.firstName), firstName: m.guest.firstName, isMe: false, isHost: false, guestOf: name }]
      : [seat];
  });
}

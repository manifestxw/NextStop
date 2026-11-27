// Side effects of a ride operation, collected as data and applied inside the same lock (ARCH §7.3).
import { randomUUID } from 'node:crypto';
import { toIso } from '../clock/amman.js';
import type { Us } from '../engine/types.js';
import type { Repo } from '../store/repo.js';
import type { Banner, ChatMessage } from './types.js';

export interface Effects {
  messages: Omit<ChatMessage, 'id' | 'seq' | 'at'>[];
  banners: Omit<Banner, 'id' | 'at' | 'seen'>[];
  outstanding: { userId: string; deltaP: number }[];      // late-leave charges and reversals
  driverCredit: { userId: string; deltaP: number }[];     // paid only at COMPLETED
  expireInvites: string[];                                // ride ids leaving OPEN (SPEC §3.17 B)
  touched: Set<string>;                                   // users whose view changed
  created: ChatMessage[];                                 // filled by applyEffects, pushed as `chat` events
}

export const newEffects = (): Effects =>
  ({ messages: [], banners: [], outstanding: [], driverCredit: [], expireInvites: [], touched: new Set(), created: [] });

export const system = (fx: Effects, rideId: string, text: string) =>
  { fx.messages.push({ rideId, channel: 'group', kind: 'system', text }); };

export async function applyEffects(repo: Repo, fx: Effects, now: Us) {
  const at = toIso(now);
  for (const m of fx.messages) fx.created.push(await repo.addMessage({ ...m, id: randomUUID(), at }));
  for (const b of fx.banners) { await repo.addBanner({ ...b, id: randomUUID(), at, seen: false }); fx.touched.add(b.userId); }
  for (const o of fx.outstanding) {
    const u = await repo.getUser(o.userId);
    if (u) await repo.putUser({ ...u, outstandingP: u.outstandingP + o.deltaP });
  }
  for (const rideId of fx.expireInvites) {
    for (const i of await repo.listInvitesForRide(rideId)) if (i.state === 'PENDING') fx.touched.add(i.toUserId);
    await repo.expireInvites(rideId);
  }
  for (const c of fx.driverCredit) {
    const d = await repo.getDriver(c.userId);
    if (d) await repo.putDriver({ ...d, creditBalanceP: d.creditBalanceP + c.deltaP });
  }
}

// Demo autopilot script (SPEC §2.2) for the demo menu: what each step does, what to watch on which
// phone, the numbers to expect (snapshot source), and a plain-text report of a ride's real state.
import type { DemoView } from '@nextstop/shared';
import { ammanTime12, fromIso } from '../clock/amman.js';
import { activeMembers, cashDueP, seatsOf } from '../domain/bridge.js';
import type { SummaryRecord } from '../domain/rides.js';
import type { Ride } from '../domain/types.js';
import type { Repo } from '../store/repo.js';

type Step = DemoView['script'][number];

/** The cast of each demo: the men-only ride (Laith) or the women-only ride (Lina), same route, times and prices. */
export const CASTS = {
  men: { host: 'laith', rider: 'saed', hostName: 'Laith', riderName: 'Saed', simA: "Deya'a", simB: 'Adnan', only: 'men' },
  women: { host: 'lina', rider: 'sara', hostName: 'Lina', riderName: 'Sara', simA: 'Rasha', simB: 'Hala', only: 'women' },
} as const;
export type Scenario = keyof typeof CASTS;

export function scriptFor(scenario: Scenario): Step[] {
  const c = CASTS[scenario];
  return [
  {
    step: 1, title: `${c.hostName} creates a ride`, who: `${c.hostName} (host)`,
    does: `Creates a ${c.only}-only Economy ride from Irbid City Center to JUST, arriving by 8:00 AM.`,
    watch: [
      { phone: `${c.hostName}`, what: 'The Sync Pass appears: 1 of 4 synced, the solo price, "Be ready by" and "Starts automatically at" (45 min before the first pickup).' },
      { phone: 'Demo menu', what: `${c.hostName}'s ride shows up in the ride list as OPEN.` },
    ],
    expect: `${c.hostName} alone: JOD 5.35 (same as riding solo).`,
  },
  {
    step: 2, title: `${c.riderName} joins and says hi`, who: `${c.riderName}`,
    does: `Searches from University Street to JUST, joins ${c.hostName}'s ride, then posts "Hi! I'm near University Street" in the group chat.`,
    watch: [
      { phone: `${c.hostName}`, what: 'The seat meter fills to 2 of 4, the price flaps down, the group chat shows an unread badge.' },
      { phone: `${c.riderName}`, what: 'Their own Sync Pass: now the first pickup, with their own "Be ready by" time.' },
    ],
    expect: `2 riders: JOD 3.10 each. ${c.riderName} becomes pickup 1.`,
  },
  {
    step: 3, title: 'Two simulated riders join', who: `${c.simA} (Arabella Mall) and ${c.simB} (University Street, same spot as ${c.riderName})`,
    does: 'The two simulated riders join through the same join rules as real phones.',
    watch: [
      { phone: `${c.hostName} + ${c.riderName}`, what: 'Each join flaps the price down (2.20, then 1.70) and the seat meter reaches 4 of 4: the ride is full.' },
      { phone: 'Group chat', what: `"${c.simA} joined" and "${c.simB} joined" system lines.` },
    ],
    expect: '3 riders: JOD 2.20 each, then 4 riders: JOD 1.70 each.',
  },
  {
    step: 4, title: `${c.hostName} finds a driver; ${c.hostName} and ${c.riderName} are ready`, who: `${c.hostName}, ${c.riderName} (${c.simA} and ${c.simB} answer by themselves)`,
    does: `${c.hostName} taps "Find a driver": the ready check starts. ${c.hostName} and ${c.riderName} answer Ready; the simulated riders answer after about 3 seconds.`,
    watch: [
      { phone: `${c.hostName} + ${c.riderName}`, what: 'The ready check sheet, then "Finding driver" on the progress rail once all four are ready.' },
      { phone: 'Yazeed', what: 'An offer card: Economy, 4 riders, fare and cash to collect, "Respond by".' },
    ],
    expect: 'Offer to Yazeed: fare JOD 6.71, collect JOD 6.80. Wait ~3 s before the next step.',
  },
  {
    step: 5, title: 'Yazeed accepts', who: 'Yazeed (driver)',
    does: 'Yazeed accepts the offer. The pickup order and times are now final.',
    watch: [
      { phone: 'Yazeed', what: 'The trip screen: numbered pickups on the dark map with the orange road route, a chat button per rider, "Collect JOD 6.80".' },
      { phone: 'Riders', what: '"Driver on the way": Yazeed, White Hyundai Elantra, plate 12-34567; "Message Yazeed" card.' },
    ],
    expect: `First pickup ${c.riderName} at 7:20 AM. Yazeed collects JOD 6.80.`,
  },
  {
    step: 6, title: `6:53: ${c.riderName} leaves late`, who: `${c.riderName}`,
    does: `The clock jumps to 6:53 AM (27 min before the first pickup, after the free-leave cutoff) and ${c.riderName} leaves, accepting the late charge.`,
    watch: [
      { phone: `${c.riderName}`, what: 'The share goes on their balance as a late-leave charge; they see the "You left" screen.' },
      { phone: `${c.hostName}`, what: `The price goes down a little (the route got shorter). The driver keeps ${c.riderName}'s money as credit.` },
      { phone: 'Yazeed', what: `${c.riderName}'s stop disappears; 3 pickups left; the route is redrawn.` },
    ],
    expect: `${c.riderName} charged JOD 1.70. The other 3: JOD 1.65 each. Yazeed: 4.95 cash + 1.70 credit.`,
  },
  {
    step: 7, title: 'Complete trip', who: 'Demo menu',
    does: 'Marks the trip as done: everyone is dropped off, the credit is paid to the driver, the summaries are written.',
    watch: [
      { phone: 'Riders', what: 'The trip summary: paid, saved compared to riding solo, arrival time.' },
      { phone: 'Yazeed', what: 'Earnings: cash per rider plus the late-leave credit.' },
    ],
    expect: `${c.hostName} saved JOD 3.70 (5.35 → 1.65). Yazeed earns JOD 6.65.`,
  },
];
}

const jod = (p: number) => (p / 100).toFixed(2);

/** What the ride looks like right now, in plain lines (demo menu "Live" panel and the step log). */
export async function describeRide(repo: Repo, ride: Ride, readyLeadMin = 45): Promise<string[]> {
  const name = async (id: string) => (await repo.getUser(id))?.firstName ?? '?';
  const active = activeMembers(ride);
  const seats = active.reduce((n, m) => n + seatsOf(m), 0);
  const lines: string[] = [];
  if (ride.state === 'COMPLETED') {
    const s = ride.summary as SummaryRecord;
    for (const r of s.riders) lines.push(`${r.firstName} paid JOD ${jod(r.cashP)}`);
    const cash = s.totalP - s.creditP - (s.uniCreditP ?? 0);
    lines.push(`Yazeed earns JOD ${jod(s.totalP)} (${jod(cash)} cash + ${jod(s.creditP + (s.uniCreditP ?? 0))} credit)`.replace('Yazeed', ride.driverUserId ? await name(ride.driverUserId) : 'Driver'));
    return lines;
  }
  lines.push(`${ride.state} · ${seats} rider${seats === 1 ? '' : 's'} · JOD ${jod(ride.plan.shareP)} each · fare JOD ${ride.plan.fareJod.toFixed(2)}`);
  const pickups = ride.plan.stops.filter((s) => s.kind === 'P');
  const nOf = (id: string) => pickups.findIndex((s) => s.userId === id) + 1;
  for (const m of [...active].sort((a, b) => nOf(a.userId) - nOf(b.userId))) {
    const n = nOf(m.userId);
    const ready = ride.readyCheck ? ` · ready: ${m.readyAnswer === 'READY' ? 'yes' : m.readyAnswer === 'CANCEL' ? 'canceled' : 'waiting'}` : '';
    lines.push(`  ${n}. ${await name(m.userId)}${m.guest ? ` +${m.guest.firstName}` : ''} · ${m.pickup.area} · be ready by ${ammanTime12(fromIso(m.shownPickup))} · pays JOD ${jod(cashDueP(m, ride.plan.shareP))}${ready}`);
  }
  for (const m of ride.members.filter((x) => x.leave)) {
    lines.push(`${await name(m.userId)} left ${m.leave!.late ? 'late' : 'free'} at ${ammanTime12(fromIso(m.leave!.at))}${m.leave!.late ? ` · charged JOD ${jod(m.leave!.chargedP)}` : ''}`);
  }
  if (ride.state === 'OPEN') lines.push(`Ready check starts automatically at ${ammanTime12(fromIso(ride.plan.firstPickup) - readyLeadMin * 60_000_000)} (${readyLeadMin} min before the first pickup)`);
  if (ride.readyCheck) lines.push(`Ready check ends ${ammanTime12(fromIso(ride.readyCheck.endsAt))}`);
  if (ride.dispatch && !ride.driverUserId) {
    lines.push(`Offer sent to ${(await Promise.all(ride.dispatch.offeredTo.map(name))).join(', ')} · expires ${ammanTime12(fromIso(ride.dispatch.expiresAt))}`);
  }
  if (ride.driverUserId) {
    const collect = active.reduce((n, m) => n + cashDueP(m, ride.plan.shareP), 0);
    lines.push(`Driver ${await name(ride.driverUserId)} · collects JOD ${jod(collect)}${ride.creditsP ? ` + JOD ${jod(ride.creditsP)} credit` : ''}`);
    lines.push(`First pickup ${ammanTime12(fromIso(ride.plan.firstPickup))}`);
  }
  return lines;
}

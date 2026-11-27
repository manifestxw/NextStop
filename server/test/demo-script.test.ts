// T10: replays the SPEC §2.2 demo, steps 1–6, on the stage setup (Snapshot source + Google places) and
// checks the SPEC §2.3 numbers at each step. If the snapshot is regenerated, update both together.
import { describe, expect, it } from 'vitest';
import { makeHarness, trip, rider, driver, hhmm } from './helpers.js';

describe('SPEC §2.2 demo script (stage data)', () => {
  it('runs end to end with the canonical numbers', async () => {
    const h = await makeHarness({ stage: true });
    const { cmd } = h;
    const laith = await h.login('laith'), saed = await h.login('saed'), yazeed = await h.login('yazeed');
    const fare = async (id: string) => (await h.store.withLock((r) => r.getRide(id)))!.plan.fareJod;

    // 1. Laith creates (clock paused at 6:10)
    const q = (await cmd.quote(laith, trip('CC'))).categories[0]!;
    expect([q.soloJod, q.estimates.map((e) => e.eachJod), q.fromJod, hhmm(q.beReadyBy)]).toEqual([5.35, [5.35, 2.8, 2.0, 1.6], 1.6, '07:36']);
    const created = rider(await cmd.createRide(laith, trip('CC'))).ride!;
    const rideId = created.id;
    expect([await fare(rideId), created.shareJod, hhmm(created.beReadyBy)]).toEqual([5.32, 5.35, '07:36']);

    // 2. Saed joins and chats
    const card = (await cmd.search(saed, trip('US')))[0]!;
    expect([card.eachJod, hhmm(card.myPickupAt), card.pickupArea]).toEqual([3.1, '07:26', 'City Center area']);
    await cmd.join(saed, rideId, trip('US'));
    expect(await fare(rideId)).toBe(6.18);
    await cmd.chat(saed, rideId, { channel: 'group', text: "Hi! I'm near University Street" });

    // 3. Deya\'a (Arabella) and Adnan (University Street, with Saed) fill the car; Laith finds a driver
    await cmd.demo.simulateRider(rideId);
    expect([await fare(rideId), rider(await cmd.me(laith)).ride!.shareJod]).toEqual([6.59, 2.2]);
    await cmd.demo.simulateRider(rideId);
    const r = rider(await cmd.me(laith)).ride!;
    expect([r.seats.map((s) => s.firstName), await fare(rideId), r.shareJod, hhmm(r.beReadyBy)]).toEqual([['Laith', 'Saed', 'Deya\'a', 'Adnan'], 6.71, 1.7, '07:33']);
    await cmd.findDriver(laith, rideId);
    h.real.ms += 3_000;
    await cmd.tick();
    await cmd.ready(laith, rideId, { answer: 'READY' });
    await cmd.ready(saed, rideId, { answer: 'READY' });

    // 4. Yazeed's offer, then accept
    const offer = driver(await cmd.me(yazeed)).offers[0]!;
    expect([offer.fareJod, offer.riders, offer.collectJod, offer.km, Math.round(offer.min), hhmm(offer.firstPickupAt), hhmm(offer.respondBy)])
      .toEqual([6.71, 4, 6.8, 17.2, 35, '07:20', '07:05']);
    expect(offer.stops.map((s) => `${s.kind} ${s.firstName} ${hhmm(s.at)}`))
      .toEqual(['P Saed 07:20', 'P Adnan 07:21', 'P Deya\'a 07:29', 'P Laith 07:33', 'D Laith 07:52', 'D Saed 07:53', 'D Deya\'a 07:53', 'D Adnan 07:54']);
    await cmd.accept(yazeed, rideId);

    // 5. 6:53 (27 min before the first pickup): Saed leaves late
    await cmd.demo.clock({ jumpTo: '2026-11-29T06:53:00+03:00' });
    expect(rider(await cmd.me(saed)).ride!.leave).toEqual({ free: false, chargeJod: 1.7, canLeave: true });
    await cmd.leave(saed, rideId, { acceptCharge: true });
    const r5 = rider(await cmd.me(laith)).ride!;
    expect([await fare(rideId), r5.shareJod, r5.seats.length, hhmm(r5.beReadyBy)]).toEqual([6.59, 1.65, 3, '07:33']);
    const t5 = driver(await cmd.me(yazeed)).trip!;
    expect([t5.collectJod, t5.creditJod]).toEqual([4.95, 1.7]);
    expect(driver(await cmd.me(yazeed)).banners.map((b) => b.text)).toContain('Saed canceled. Collect JOD 4.95 cash · JOD 1.70 credit at trip end');

    // 6. Complete trip → summaries
    await cmd.demo.completeTrip(rideId);
    const ls = rider(await cmd.me(laith)).ride!.summary!;
    expect([ls.paidJod, ls.riders, ls.savedJod, hhmm(ls.arrivedAt)]).toEqual([1.65, 3, 3.7, '07:52']);
    expect(rider(await cmd.me(saed)).ride!.summary!.leftLate).toEqual({ chargedJod: 1.7 });
    const ds = driver(await cmd.me(yazeed)).trip!.summary!;
    expect([ds.riders.map((x) => `${x.firstName} ${x.cashJod}`), ds.creditJod, ds.totalJod]).toEqual([['Laith 1.65', 'Deya\'a 1.65', 'Adnan 1.65'], 1.7, 6.65]);
  });
});

describe('demo autopilot (demo menu "Play next step")', () => {
  it('plays the same script step by step from the ride state and ends on the canonical numbers', async () => {
    const h = await makeHarness({ stage: true });
    const labels: string[] = [];
    for (let i = 0; i < 10; i++) {
      const next = (await h.cmd.demo.view()).autopilot;
      if (!next) break;
      labels.push(next.label);
      await h.cmd.demo.autopilot();
      h.real.ms += 3_000;              // simulated riders answer the ready check after 3 s
      await h.cmd.tick();
    }
    expect(labels).toEqual([
      'Laith creates a ride', 'Saed joins and says hi', 'Two simulated riders join',
      'Laith finds a driver; Laith and Saed are ready', 'Yazeed accepts', '6:53: Saed leaves late', 'Complete trip',
    ]);
    const yazeed = await h.login('yazeed');
    const ds = driver(await h.cmd.me(yazeed)).trip!.summary!;
    expect([ds.riders.map((x) => x.cashJod), ds.creditJod, ds.totalJod]).toEqual([[1.65, 1.65, 1.65], 1.7, 6.65]);
    expect((await h.cmd.demo.view()).autopilot).toBeNull();

    // The demo menu explains every step and logs what really happened after each tap.
    const v = await h.cmd.demo.view();
    expect(v.script.map((x) => x.title)).toEqual(labels);
    expect(v.script.every((x) => x.who && x.does && x.watch.length > 0 && x.expect)).toBe(true);
    const log = (n: number) => v.log.find((e) => e.step === n)!.lines.join('\n');
    expect(v.log.map((e) => e.step)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(log(1)).toContain('1 rider · JOD 5.35 each');
    expect(log(2)).toContain('2 riders · JOD 3.10 each');
    expect(log(3)).toContain('4 riders · JOD 1.70 each');
    expect(log(4)).toMatch(/Laith · City Center area .* ready: yes/);
    expect(log(4)).toMatch(/Deya'a .* ready: waiting/);
    expect(log(5)).toContain('Driver Yazeed · collects JOD 6.80');
    expect(log(5)).toContain('First pickup 7:20 AM');
    expect(log(6)).toContain('Saed left late at 6:53 AM · charged JOD 1.70');
    expect(log(6)).toContain('3 riders · JOD 1.65 each');
    expect(log(7)).toContain('Yazeed earns JOD 6.65 (4.95 cash + 1.70 credit)');
    expect(v.now).toEqual([]);   // no active script ride after completion
    await h.cmd.demo.reset();
    expect((await h.cmd.demo.view()).log).toEqual([]);
  });
});

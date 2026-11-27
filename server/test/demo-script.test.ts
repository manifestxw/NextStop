// T10: replays the SPEC §2.2 demo, steps 1–6, and checks the §2.3 numbers at each step.
import { describe, expect, it } from 'vitest';
import { makeHarness, trip, rider, driver, hhmm } from './helpers.js';

describe('SPEC §2.2 demo script', () => {
  it('runs end to end with the canonical numbers', async () => {
    const h = await makeHarness();
    const { cmd } = h;
    const lina = await h.login('lina'), sara = await h.login('sara'), omar = await h.login('omar');

    // 1. Lina creates (clock paused at 6:10)
    const created = rider(await cmd.createRide(lina, trip('CC'))).ride!;
    expect([created.shareJod, hhmm(created.beReadyBy)]).toEqual([7.85, '07:15']);
    const rideId = created.id;

    // 2. Sara joins and chats
    const card = (await cmd.search(sara, trip('US')))[0]!;
    expect([card.eachJod, card.pickupArea]).toEqual([4.0, 'City Center area']);
    await cmd.join(sara, rideId, trip('US'));
    await cmd.chat(sara, rideId, { channel: 'group', text: "Hi! I'm near University Street" });

    // 3. Two simulated riders fill the car; Lina finds a driver; sims answer Ready after 3 s real time
    await cmd.demo.simulateRider(rideId);
    await cmd.demo.simulateRider(rideId);
    let r = rider(await cmd.me(lina)).ride!;
    expect([r.seats.map((s) => s.firstName), r.shareJod, hhmm(r.beReadyBy)]).toEqual([['Lina', 'Sara', 'Rania', 'Dana'], 2.3, '07:02']);
    expect(r.chat.group.map((m) => m.text)).toEqual(expect.arrayContaining(['Hi everyone 👋', "I'll be at the main gate", "Hi! I'm near University Street"]));
    await cmd.findDriver(lina, rideId);
    h.real.ms += 3_000;
    await cmd.tick();
    await cmd.ready(lina, rideId, { answer: 'READY' });
    await cmd.ready(sara, rideId, { answer: 'READY' });

    // 4. Omar's offer, then accept
    const offer = driver(await cmd.me(omar)).offers[0]!;
    expect([offer.fareJod, offer.riders, offer.collectJod, offer.km, Math.round(offer.min), hhmm(offer.firstPickupAt), hhmm(offer.respondBy)])
      .toEqual([9.03, 4, 9.2, 21.4, 54, '07:02', '06:47']);
    expect(offer.stops.map((s) => `${s.kind} ${s.firstName} ${hhmm(s.at)}`).slice(0, 4))
      .toEqual(['P Lina 07:02', 'P Rania 07:10', 'P Sara 07:17', 'P Dana 07:22']);
    expect(offer.stops.every((s) => s.place === undefined)).toBe(true);     // no coordinates before accept
    await cmd.accept(omar, rideId);
    expect(rider(await cmd.me(sara)).ride!.driver).toEqual({ firstName: 'Omar', car: 'White Hyundai Elantra', plate: '12-34567' });

    // 5. 6:35: Sara leaves late
    await cmd.demo.clock({ jumpTo: '2026-11-29T06:35:00+03:00' });
    expect(rider(await cmd.me(sara)).ride!.leave).toEqual({ free: false, chargeJod: 2.3 });
    await cmd.leave(sara, rideId, { acceptCharge: true });
    r = rider(await cmd.me(lina)).ride!;
    expect([r.shareJod, r.seats.length, hhmm(r.beReadyBy)]).toEqual([2.2, 3, '07:02']);
    const trip5 = driver(await cmd.me(omar)).trip!;
    expect([trip5.collectJod, trip5.creditJod, trip5.stops.filter((s) => s.kind === 'P').map((s) => `${s.firstName} ${hhmm(s.at)}`)])
      .toEqual([6.6, 2.3, ['Lina 07:02', 'Rania 07:10', 'Dana 07:22']]);
    expect(driver(await cmd.me(omar)).banners.map((b) => b.text)).toContain('Sara canceled. Collect JOD 6.60 cash · JOD 2.30 credit at trip end');
    expect(rider(await cmd.me(sara)).me.outstandingJod).toBe(2.3);

    // 6. Complete trip → summaries
    await cmd.demo.completeTrip(rideId);
    const ls = rider(await cmd.me(lina)).ride!;
    expect([ls.state, ls.summary!.paidJod, ls.summary!.riders, ls.summary!.savedJod]).toEqual(['COMPLETED', 2.2, 3, 5.65]);
    expect(rider(await cmd.me(sara)).ride!.summary!.leftLate).toEqual({ chargedJod: 2.3 });
    const ds = driver(await cmd.me(omar)).trip!.summary!;
    expect([ds.riders.map((x) => `${x.firstName} ${x.cashJod}`), ds.creditJod, ds.totalJod]).toEqual([['Lina 2.2', 'Rania 2.2', 'Dana 2.2'], 2.3, 8.9]);
    expect((await h.store.withLock((x) => x.getDriver('u-omar')))!.creditBalanceP).toBe(230);
  });
});

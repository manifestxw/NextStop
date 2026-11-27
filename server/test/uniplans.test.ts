// T15 (SPEC §3.19): Uni plans. Pure helpers match fare_model.py; the domain runs end to end.
import { describe, expect, it } from 'vitest';
import { makeHarness, rider, driver } from './helpers.js';
import { ConflictError } from '../src/domain/errors.js';
import { uniPaid, replacementsFor, cancelOutcome, isTestCard } from '../src/engine/uni.js';

const code = async (p: Promise<unknown>) => {
  try { await p; return 'ok'; } catch (e) { if (e instanceof ConflictError) return e.code; throw e; }
};
const card = { number: '4242 4242 4242 4242', expiry: '12/27', cvc: '123' };
const t = (pickup: string, iso: string, dest = 'JUST') => ({ pickup: { key: pickup }, dest: { key: dest }, arriveBy: iso, category: 'economy' as const, sameGenderOnly: true });
const MON = '2026-11-30T08:00:00+03:00', TUE = '2026-12-01T08:00:00+03:00', WED = '2026-12-02T08:00:00+03:00';

describe('Uni plan helpers (fare_model.py v8)', () => {
  it('discount, replacements, 12 h cutoff, test cards', () => {
    expect([uniPaid(2.3), uniPaid(4.0), uniPaid(1.7)]).toEqual([1.85, 3.2, 1.4]);
    expect([replacementsFor('weekly', 5), ...[26, 40, 52, 65, 80].map((n) => replacementsFor('semester', n))]).toEqual([1, 1, 2, 2, 3, 4]);
    expect([cancelOutcome(720, 1), cancelOutcome(719, 1), cancelOutcome(780, 0)]).toEqual([['replacement', 0], ['use_leave', 1], ['gone', 0]]);
    expect([isTestCard('4242424242424242'), isTestCard('4111111111111112')]).toEqual([true, false]);
  });
});

describe('subscribe (SPEC §3.19)', () => {
  it('weekly: 3 uni rides, demo card, only the last 4 digits kept', async () => {
    const h = await makeHarness();
    const lina = await h.login('lina');
    const v = rider(await h.cmd.subscribe(lina, { kind: 'weekly', trips: [t('CC', MON), t('CC', TUE), t('CC', WED)], card }));
    expect([v.plan!.kind, v.plan!.trips.map((x) => x.state), v.plan!.card, v.plan!.replacementsLeft]).toEqual(['weekly', ['PLANNED', 'PLANNED', 'PLANNED'], { last4: '4242' }, 1]);
    const sub = await h.store.withLock((r) => r.getSubscription('u-lina'));
    expect([sub!.pricePaidP, JSON.stringify(sub).includes('4242424242424242')]).toEqual([200, false]);
  });

  it('refuses a non-test card, a non-campus trip, a trip under 12 h away and a second plan', async () => {
    const h = await makeHarness();
    const lina = await h.login('lina');
    expect(await code(h.cmd.subscribe(lina, { kind: 'weekly', trips: [t('CC', MON), t('CC', TUE), t('CC', WED)], card: { ...card, number: '4111 1111 1111 1112' } }))).toBe('NOT_TEST_CARD');
    expect(await code(h.cmd.subscribe(lina, { kind: 'weekly', trips: [t('CC', MON), t('CC', TUE), t('HS', WED, 'AM')], card }))).toBe('NOT_ELIGIBLE');
    expect(await code(h.cmd.subscribe(lina, { kind: 'weekly', trips: [t('CC', '2026-11-29T16:00:00+03:00'), t('CC', TUE), t('CC', WED)], card }))).toBe('NOT_ELIGIBLE');
    await h.cmd.subscribe(lina, { kind: 'weekly', trips: [t('CC', MON), t('CC', TUE), t('CC', WED)], card });
    expect(await code(h.cmd.subscribe(lina, { kind: 'weekly', trips: [t('CC', MON), t('CC', TUE), t('CC', WED)], card }))).toBe('NOT_ELIGIBLE');
  });

  it('semester: a weekly pattern repeated to the end of the semester; price per week; replacements 5% (min 1)', async () => {
    const h = await makeHarness();
    const sara = await h.login('sara');
    const item = (weekday: number) => ({ weekday, arriveByTime: '08:00', pickup: { key: 'US' }, dest: { key: 'JUST' }, category: 'economy' as const, sameGenderOnly: true });
    const v = rider(await h.cmd.subscribe(sara, { kind: 'semester', pattern: [item(1), item(2)], card }));
    const n = v.plan!.trips.length;
    expect(n).toBe(18);                                       // Mon/Tue from 30 Nov to 31 Jan
    expect(v.plan!.replacementsLeft).toBe(1);
    expect((await h.store.withLock((r) => r.getSubscription('u-sara')))!.pricePaidP).toBe(160 * 10);   // 10 weeks left
  });
});

describe('cancel and replace (SPEC §3.19)', () => {
  it('≥ 12 h: a replacement while under the limit, then gone; < 12 h: use the normal leave', async () => {
    const h = await makeHarness();
    const lina = await h.login('lina');
    const v = rider(await h.cmd.subscribe(lina, { kind: 'weekly', trips: [t('CC', MON), t('CC', TUE), t('CC', WED)], card }));
    const [mon, tue, wed] = v.plan!.trips.map((x) => x.id);
    let p = rider(await h.cmd.cancelPlanned(lina, tue!)).plan!;
    expect([p.replacementsLeft, p.replacementCredits, p.trips.find((x) => x.id === tue)!.state]).toEqual([0, 1, 'CANCELED']);
    p = rider(await h.cmd.cancelPlanned(lina, wed!)).plan!;
    expect([p.replacementsLeft, p.replacementCredits]).toEqual([0, 1]);   // over the limit: gone
    p = rider(await h.cmd.planReplacement(lina, { trip: t('CC', '2026-12-03T08:00:00+03:00') })).plan!;
    expect([p.replacementCredits, p.trips.filter((x) => x.state === 'PLANNED').length]).toEqual([0, 2]);
    await h.cmd.demo.clock({ jumpTo: '2026-11-29T21:00:00+03:00' });      // Mon 8:00 is now 11 h away (and placed)
    expect(await code(h.cmd.cancelPlanned(lina, mon!))).toBe('USE_LEAVE');
  });
});

describe('placement 12 h ahead and the 20% discount (SPEC §3.19)', () => {
  it('two subscribers land in one car; each pays 80% of the share; RideSync pays the driver the rest', async () => {
    const h = await makeHarness();
    const lina = await h.login('lina'), sara = await h.login('sara'), omar = await h.login('omar');
    await h.cmd.subscribe(lina, { kind: 'weekly', trips: [t('CC', MON), t('CC', TUE), t('CC', WED)], card });
    await h.cmd.subscribe(sara, { kind: 'weekly', trips: [t('US', MON), t('US', TUE), t('US', WED)], card });
    await h.cmd.demo.clock({ jumpTo: '2026-11-29T20:00:00+03:00' });      // Mon 8:00 − 12 h
    const lv = rider(await h.cmd.me(lina));
    expect([lv.ride!.seats.map((s) => s.firstName), lv.ride!.shareJod, lv.ride!.myCashDueJod, lv.ride!.uniDiscountJod]).toEqual([['Lina', 'Sara'], 4.0, 3.2, 0.8]);
    expect(lv.plan!.trips[0]!.state).toBe('PLACED');
    const id = lv.ride!.id;
    await h.cmd.findDriver(lina, id);
    await h.cmd.ready(lina, id, { answer: 'READY' });
    await h.cmd.ready(sara, id, { answer: 'READY' });
    const offer = driver(await h.cmd.me(omar)).offers[0]!;
    expect([offer.collectJod, offer.stops.filter((s) => s.kind === 'P').map((s) => [s.cashDueJod, s.uniCreditJod])]).toEqual([6.4, [[3.2, 0.8], [3.2, 0.8]]]);
    await h.cmd.accept(omar, id);
    await h.cmd.demo.completeTrip(id);
    const s = driver(await h.cmd.me(omar)).trip!.summary!;
    expect([s.riders.map((x) => x.cashJod), s.uniCreditJod, s.totalJod]).toEqual([[3.2, 3.2], 1.6, 8.0]);
    expect((await h.store.withLock((r) => r.getDriver('u-omar')))!.creditBalanceP).toBe(160);
  });

  it('a planned ride that cannot be placed becomes a free replacement', async () => {
    const h = await makeHarness();
    const lina = await h.login('lina');
    await h.cmd.subscribe(lina, { kind: 'weekly', trips: [t('CC', MON), t('CC', TUE), t('CC', WED)], card });
    await h.cmd.demo.clock({ jumpTo: '2026-11-29T19:59:00+03:00' });
    await h.cmd.createRide(lina, { ...t('CC', '2026-11-30T07:50:00+03:00') });   // her own overlapping ride → rule 12
    await h.cmd.demo.clock({ advanceMin: 1 });
    const p = rider(await h.cmd.me(lina)).plan!;
    expect([p.trips[0]!.state, p.replacementCredits, p.replacementsLeft]).toEqual(['UNPLACEABLE', 1, 1]);
  });

  it('the demo menu can place tomorrow\'s planned rides early', async () => {
    const h = await makeHarness();
    const lina = await h.login('lina');
    await h.cmd.subscribe(lina, { kind: 'weekly', trips: [t('CC', MON), t('CC', TUE), t('CC', WED)], card });
    await h.cmd.demo.placePlanned();
    const v = rider(await h.cmd.me(lina));
    expect([v.plan!.trips.map((x) => x.state), v.ride?.myCashDueJod]).toEqual([['PLACED', 'PLANNED', 'PLANNED'], 6.3]);
  });
});

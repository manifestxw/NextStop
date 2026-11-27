// T20 (P1): driver route line, rider ↔ driver chat, places proxy.
import { describe, expect, it } from 'vitest';
import { makeHarness, trip, rider, driver } from './helpers.js';
import { ConflictError } from '../src/domain/errors.js';

async function accepted() {
  const h = await makeHarness({ stage: true });
  const lina = await h.login('lina'), sara = await h.login('sara'), omar = await h.login('omar');
  const rideId = rider(await h.cmd.createRide(lina, trip('CC'))).ride!.id;
  await h.cmd.join(sara, rideId, trip('US'));
  await h.cmd.findDriver(lina, rideId);
  await h.cmd.ready(lina, rideId, { answer: 'READY' });
  await h.cmd.ready(sara, rideId, { answer: 'READY' });
  return { ...h, lina, sara, omar, rideId };
}

describe('driver route line (SPEC §3.9, §3.14)', () => {
  it('the accepted driver gets the road route through the stops; riders never do', async () => {
    const { cmd, omar, sara, lina, rideId } = await accepted();
    await cmd.accept(omar, rideId);
    const route = driver(await cmd.me(omar)).trip!.route!;
    expect(route.length).toBeGreaterThan(20);                       // snapshot polylines, not 4 straight points
    expect(JSON.stringify(rider(await cmd.me(lina)))).not.toContain('"route"');
    await cmd.demo.clock({ jumpTo: '2026-11-29T06:53:00+03:00' });
    await cmd.leave(sara, rideId, { acceptCharge: true });
    expect(driver(await cmd.me(omar)).trip!.route!.length).toBeGreaterThan(20);   // recomputed without Sara's stops
  });
});

describe('driver chat (P1, SPEC §3.11)', () => {
  it('each rider has a private channel with the driver, only after accept', async () => {
    const { cmd, omar, sara, lina, rideId } = await accepted();
    await expect(cmd.chat(sara, rideId, { channel: 'driver:u-sara', text: 'hi' })).rejects.toBeInstanceOf(ConflictError);
    await cmd.accept(omar, rideId);
    await cmd.chat(sara, rideId, { channel: 'driver:u-sara', text: 'I am at the gate, call 0791234567' });
    await cmd.chat(omar, rideId, { channel: 'driver:u-sara', text: 'On my way' });
    expect(rider(await cmd.me(sara)).ride!.chat.driver!.map((m) => m.text)).toEqual(['I am at the gate, call •••', 'On my way']);
    expect(driver(await cmd.me(omar)).trip!.chats!['u-sara']!.length).toBe(2);
    expect(rider(await cmd.me(lina)).ride!.chat.driver).toEqual([]);
    await expect(cmd.chat(lina, rideId, { channel: 'driver:u-sara', text: 'snoop' })).rejects.toBeInstanceOf(ConflictError);
    expect(driver(await cmd.me(omar)).trip!.chats!['u-sara']!.length).toBe(2);
  });
});

describe('places proxy (P1)', () => {
  it('needs 2+ characters; without a server key only the seed places match (tests have no GOOGLE_SERVER_KEY)', async () => {
    const h = await makeHarness();
    const lina = await h.login('lina');
    expect(await h.cmd.places(lina, 'i')).toEqual([]);
    expect((await h.cmd.places(lina, 'irbid')).map((p) => p.key)).toEqual(['CC']);
    expect(await h.cmd.places(lina, 'Irbid hospital')).toEqual([]);
  });
});

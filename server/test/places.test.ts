// Place search, pins and the public area name (P1). The area is what other riders see: never an address.
import { describe, expect, it } from 'vitest';
import { areaFor, pinName } from '../src/travel/places.js';
import { makeHarness, rider } from './helpers.js';

const seeds = [
  { key: 'US', name: 'University Street', area: 'University Street area', lat: 32.5445, lng: 35.8565 },
  { key: 'CC', name: 'Irbid City Center', area: 'City Center area', lat: 32.5568, lng: 35.8469 },
];

describe('areaFor', () => {
  it('near a seed place → that area (consistent with the demo places)', () => {
    expect(areaFor({ lat: 32.5450, lng: 35.8570 }, [{ text: 'Al Nuzha', types: ['neighborhood'] }], seeds)).toBe('University Street area');
  });
  it('otherwise Google neighbourhood, then sublocality, then city; never the street or number', () => {
    const far = { lat: 32.60, lng: 35.90 };
    expect(areaFor(far, [{ text: '12', types: ['street_number'] }, { text: 'Al Nuzha', types: ['neighborhood'] }, { text: 'Irbid', types: ['locality'] }], seeds)).toBe('Al Nuzha area');
    expect(areaFor(far, [{ text: 'Al Rawdah', types: ['sublocality_level_1', 'sublocality'] }, { text: 'Irbid', types: ['locality'] }], seeds)).toBe('Al Rawdah area');
    expect(areaFor(far, [{ text: 'Unnamed Road', types: ['route'] }, { text: 'Ramtha', types: ['locality'] }], seeds)).toBe('Ramtha');
    expect(areaFor(far, [], seeds)).toBe('Irbid');
  });
  it('pin names', () => {
    expect(pinName('Nutralette company')).toBe('Near Nutralette company');
    expect(pinName(undefined)).toBe('Pinned location');
  });
});

describe('places without a Google key (tests, offline)', () => {
  it('search falls back to the seed places; a pin gets the nearest seed area; the server keeps the area', async () => {
    const h = await makeHarness();
    const lina = await h.login('lina');
    expect((await h.cmd.places(lina, 'arab')).map((p) => [p.name, p.area])).toEqual([['Arabella Mall', 'Arabella area']]);
    const pin = await h.cmd.placeAt(lina, 32.5450, 35.8570);
    expect([pin.name, pin.area, pin.placeId.startsWith('pin:')]).toEqual(['Pinned location', 'University Street area', true]);
    // A client can't choose its own area: the server uses what it computed for that place.
    const v = rider(await h.cmd.createRide(lina, { pickup: { placeId: pin.placeId, name: 'My house, 12 Hidden St', lat: pin.lat, lng: pin.lng },
      dest: { key: 'JUST' }, arriveBy: '2026-11-29T08:00:00+03:00', category: 'economy', sameGenderOnly: true }));
    expect(v.ride!.myPickup.area).toBe('University Street area');
  });
  it('pins outside Jordan are refused', async () => {
    const h = await makeHarness();
    await expect(h.cmd.placeAt(await h.login('lina'), 31.5, 34.4)).rejects.toThrow(/Jordan/);
  });
});

import { streetFrom } from '../src/travel/google.js';

describe('reverse geocoding → pin name', () => {
  const comps = [{ long_name: 'Irbid', types: ['locality', 'political'] }];
  it('picks the first street address or route, without plus codes, postcodes or the country', () => {
    expect(streetFrom([
      { formatted_address: 'GVV4+VHF, Irbid, Jordan', types: ['dentist', 'establishment'], address_components: comps },
      { formatted_address: 'Feras Al Ajlouni 21110, Irbid, Jordan', types: ['premise', 'street_address'], address_components: comps },
    ])).toEqual({ name: 'Feras Al Ajlouni, Irbid', parts: [{ text: 'Irbid', types: ['locality', 'political'] }] });
    expect(streetFrom([{ formatted_address: 'Wasfi Al-Tal St, Irbid, Jordan', types: ['route'], address_components: comps }])!.name).toBe('Wasfi Al-Tal St, Irbid');
  });
  it('no street (only plus codes or areas) → null, so the nearest named place is used instead', () => {
    expect(streetFrom([{ formatted_address: 'GVV4+VHF, Irbid, Jordan', types: ['plus_code'], address_components: comps },
      { formatted_address: 'Irbid, Jordan', types: ['locality', 'political'], address_components: comps }])).toBeNull();
    expect(streetFrom([])).toBeNull();
  });
});

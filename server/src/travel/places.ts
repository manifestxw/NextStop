// Public area names and pin names for searched / pinned places (P1). The area is what other riders see
// on matching cards: a neighbourhood or a city, never a street or a number (SPEC §3.14).
import { hav } from '../engine/geo.js';
import type { LatLng } from '../engine/types.js';

export interface AddressPart { text: string; types: string[] }
export interface SeedArea extends LatLng { area: string }

const SEED_KM = 1.5;

export function areaFor(p: LatLng, parts: AddressPart[], seeds: SeedArea[]): string {
  const near = seeds.map((s) => [hav(p, s), s] as const).sort((a, b) => a[0] - b[0])[0];
  if (near && near[0] <= SEED_KM) return near[1].area;
  const pick = (t: string) => parts.find((x) => x.types.includes(t))?.text;
  const hood = pick('neighborhood') ?? pick('sublocality_level_1') ?? pick('sublocality');
  if (hood) return `${hood} area`;
  return pick('locality') ?? 'Irbid';
}

export const pinName = (nearest?: string) => (nearest ? `Near ${nearest}` : 'Pinned location');

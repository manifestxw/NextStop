// TravelProvider (ARCH §5): all km, minutes and routes come from here. The engine never calls Google.
import type { TravelSource } from '@nextstop/shared';
import { fixedMatrix, LEVEL, WEATHER, type Conditions } from './fixed.js';
import type { LatLng, TimedMatrix, Us } from '../engine/types.js';

export interface Cell { km: number; minTraffic: number; minFree: number }

/** Serializable travel data for one evaluation; stored on the ride when the fare locks. */
export type MatrixSpec =
  | { kind: 'fixed'; points: LatLng[]; cond: Conditions }
  | { kind: 'cells'; points: LatLng[]; cells: Cell[][]; cond: Conditions };   // Snapshot / Google

export interface TravelProvider {
  readonly name: TravelSource;
  getMatrix(points: LatLng[], departure: Us, cond?: Conditions): Promise<MatrixSpec>;   // ≤ 8 points
  getRoute(points: LatLng[], departure: Us): Promise<LatLng[]>;   // ordered stops; first/last = endpoints
}

export function toTimed(spec: MatrixSpec): TimedMatrix {
  if (spec.kind === 'fixed') return fixedMatrix(spec.points, spec.cond);
  const c = (i: number, j: number) => spec.cells[i]![j]!;
  // Demo multipliers scale only the traffic delay for Google/Snapshot data (SPEC §4.3).
  const mult = LEVEL[spec.cond.level ?? 'normal'] * WEATHER[spec.cond.weather ?? 'clear'];
  return {
    points: spec.points,
    km: (i, j) => c(i, j).km,
    legMin: (i, j) => c(i, j).minFree + (c(i, j).minTraffic - c(i, j).minFree) * mult,
    freeMin: (i, j) => c(i, j).minFree,
  };
}

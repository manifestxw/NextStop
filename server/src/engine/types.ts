// Engine inputs. Times are epoch MICROSECONDS (`Us`): Python's timedelta rounds to µs and the
// reference model's results depend on it (ARCH §6 porting traps).
import type { Category, Gender, GenderMode } from '@nextstop/shared';

export type Us = number;
export interface LatLng { lat: number; lng: number }

/** Travel data for one ride evaluation: points[i] are the ride's pickups and drop-offs. */
export interface TimedMatrix {
  points: LatLng[];
  km(i: number, j: number): number;                 // road km (already rounded as the source does)
  legMin(i: number, j: number, t: Us): number;      // minutes with traffic, leaving at t
  freeMin(i: number, j: number): number;            // minutes without traffic
}

export interface RiderIn {
  id: string; gender: Gender;
  p: number; d: number;      // point indices into the matrix
  by: Us;                    // arrive-by
  category?: Category;       // default economy
  sameGenderOnly?: boolean;  // default true (SPEC §3.5 rule 1)
  guest?: { gender: Gender };  // a +1 (SPEC §3.17 A)
}

export interface Stop { kind: 'P' | 'D'; rider: number; at: number }   // rider = index in the riders list

export interface Plan {
  stops: Stop[]; T0: Us; fare: number; km: number; dur: number;
  incar: Record<number, number>; pick: Record<number, Us>; drop: Record<number, Us>;
}

export type { Category, Gender, GenderMode };

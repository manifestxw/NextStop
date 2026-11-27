import type { TravelSource } from '@nextstop/shared';
import { cached } from './cached.js';
import { fixedProvider } from './fixed.js';
import { googleProvider } from './google.js';
import type { TravelProvider } from './provider.js';
import { loadSnapshot, snapshotProvider } from './snapshot.js';

const fixed = cached(fixedProvider);
const snap = loadSnapshot();
const snapshot = snap ? cached(snapshotProvider(snap)) : null;
let google: TravelProvider | null = null;
let offline = false;
/** True once a live Google call fell back to the fixed table (demo menu: "offline estimates"). */
export const travelOffline = () => offline;

/** Live Google with an automatic fallback: an error or a call over 2.5 s uses the fixed table (ARCH §5). */
export function withFallback(live: TravelProvider, fallback: TravelProvider = fixed, timeoutMs = 2500): TravelProvider {
  const race = <T>(p: Promise<T>, alt: () => Promise<T>) => {
    const timeout = new Promise<never>((_, no) => setTimeout(() => no(new Error('Google timeout')), timeoutMs));
    return Promise.race([p, timeout]).catch((e: Error) => { offline = true; console.warn(`travel: ${e.message}, using the fixed table`); return alt(); });
  };
  return {
    name: 'google',
    getMatrix: (pts, dep, cond) => race(live.getMatrix(pts, dep, cond), () => fallback.getMatrix(pts, dep, cond)),
    getRoute: (pts, dep) => race(live.getRoute(pts, dep), () => fallback.getRoute(pts, dep)),
  };
}

/** Call once at boot with the server key (live Google is optional). */
export function configureGoogle(key: string | undefined) { google = key ? cached(withFallback(googleProvider(key))) : null; }

/** The provider for the demo menu's data source. Missing snapshot or key → the fixed table. */
export function selectProvider(source: TravelSource): TravelProvider {
  if (source === 'snapshot' && snapshot) return snapshot;
  if (source === 'google' && google) return google;
  return fixed;
}

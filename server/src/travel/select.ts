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

/** Live Google with an automatic fallback: an error or a call over 2.5 s uses the fixed table (ARCH §5). */
function withFallback(live: TravelProvider): TravelProvider {
  const race = <T>(p: Promise<T>, alt: () => Promise<T>) => {
    const timeout = new Promise<never>((_, no) => setTimeout(() => no(new Error('Google timeout')), 2500));
    return Promise.race([p, timeout]).catch((e: Error) => { console.warn(`travel: ${e.message}, using the fixed table`); return alt(); });
  };
  // shortcut: the demo menu's "offline estimates" flag (P1) isn't raised yet; the fallback is logged.
  return {
    name: 'google',
    getMatrix: (pts, dep, cond) => race(live.getMatrix(pts, dep, cond), () => fixed.getMatrix(pts, dep, cond)),
    getRoute: (pts, dep) => race(live.getRoute(pts, dep), () => fixed.getRoute(pts, dep)),
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

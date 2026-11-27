import type { TravelSource } from '@nextstop/shared';
import { cached } from './cached.js';
import { fixedProvider } from './fixed.js';
import type { TravelProvider } from './provider.js';

const fixed = cached(fixedProvider);

/** The provider for the demo menu's data source (ARCH §5). */
// shortcut: Snapshot and Google sources land in T11; until then every source uses the fixed table.
export function selectProvider(_source: TravelSource): TravelProvider {
  return fixed;
}

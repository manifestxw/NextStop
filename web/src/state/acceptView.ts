import type { View } from '@nextstop/shared';

/** Accept a pushed or returned view only if it is newer, for the same user and epoch (ARCH §9.2). */
export function acceptView(current: View | null, next: View): boolean {
  if (!current) return true;
  if (next.epoch !== current.epoch || next.me.id !== current.me.id) return false;
  return next.viewSeq > current.viewSeq;
}

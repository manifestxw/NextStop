import { describe, expect, it } from 'vitest';
import type { View } from '@nextstop/shared';
import { acceptView } from './acceptView.js';

const v = (viewSeq: number, epoch = 1, id = 'u-lina') => ({ role: 'rider', epoch, viewSeq, me: { id } }) as unknown as View;

describe('acceptView (ARCH §9.2 stale views)', () => {
  it('takes the first view, then only newer sequence numbers', () => {
    expect(acceptView(null, v(5))).toBe(true);
    expect(acceptView(v(5), v(6))).toBe(true);
    expect(acceptView(v(6), v(6))).toBe(false);
    expect(acceptView(v(6), v(4))).toBe(false);   // a late HTTP response after a newer socket push
  });
  it('ignores views for another epoch or another user', () => {
    expect(acceptView(v(5, 1), v(9, 2))).toBe(false);
    expect(acceptView(v(5, 1, 'u-lina'), v(9, 1, 'u-sara'))).toBe(false);
  });
});

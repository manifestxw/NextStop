import { describe, expect, it } from 'vitest';
import { maskChat } from '../src/domain/chat.js';

describe('chat masking (ARCH §9.4)', () => {
  it.each([
    ['Call me 079 123 4567', 'Call me •••'],
    ['+962-79-1234567 anytime', '+•••anytime'],
    ['wa.me/962791234567', '•••'],
    ['see https://example.com/x now', 'see ••• now'],
    ['www.site.jo', '•••'],
  ])('%s', (input, want) => { expect(maskChat(input)).toBe(want); });

  it('leaves times and prices alone', () => {
    expect(maskChat('JUST main gate at 7:02')).toBe('JUST main gate at 7:02');
    expect(maskChat('JOD 2.30 each')).toBe('JOD 2.30 each');
  });
});

import { ERROR_MESSAGES, type ConflictCode } from '@nextstop/shared';

/** A domain conflict → HTTP 409 {code, message, ...extra} (ARCH §7.1). */
export class ConflictError extends Error {
  override name = 'ConflictError';
  constructor(public code: ConflictCode, message?: string, public extra: { chargeJod?: number } = {}) {
    super(message ?? ERROR_MESSAGES[code]);
  }
}
/** Bad token or old epoch → HTTP 401 {code: 'LOGGED_OUT'}. */
export class LoggedOutError extends Error { override name = 'LoggedOutError'; }

export const illegal = (why: string) => new ConflictError('ILLEGAL_STATE', why);

const MINIMUM_WAIT_MS = 60_000;
const RATE_LIMIT_WAIT_MS = 300_000;

export function isAuthEmailRateLimit(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const value = error as { status?: number; code?: string };
  return value.status === 429 ||
    value.code === 'over_email_send_rate_limit' ||
    value.code === 'over_request_rate_limit';
}

export class AuthEmailWaitError extends Error {
  constructor() {
    super('Please wait before requesting another email.');
    this.name = 'AuthEmailWaitError';
  }
}

// One gate for every email-sending flow. Changing sheets, addresses or accounts
// cannot bypass it. No address, password or token is stored here.
export function createAuthEmailGate(now: () => number = Date.now) {
  let active = false;
  let nextAllowedAt = 0;
  return {
    remainingSeconds() {
      return Math.max(0, Math.ceil((nextAllowedAt - now()) / 1000));
    },
    async run<T extends { error: unknown }>(send: () => Promise<T>) {
      if (active || now() < nextAllowedAt) throw new AuthEmailWaitError();
      active = true;
      nextAllowedAt = now() + MINIMUM_WAIT_MS;
      try {
        const result = await send();
        if (result.error) throw result.error;
        return result;
      } catch (error) {
        if (isAuthEmailRateLimit(error))
          nextAllowedAt = Math.max(nextAllowedAt, now() + RATE_LIMIT_WAIT_MS);
        throw error;
      } finally {
        active = false;
      }
    },
  };
}

export function authEmailErrorMessage(error: unknown) {
  if (error instanceof AuthEmailWaitError) return error.message;
  if (isAuthEmailRateLimit(error))
    return 'Email requests are temporarily limited. Wait at least five minutes before trying again. If this continues, contact support.';
  const code = error && typeof error === 'object'
    ? (error as { code?: string }).code : undefined;
  if (code === 'email_address_invalid' || code === 'validation_failed')
    return 'Check the email address and try again after the wait period.';
  return 'We could not complete the email request. Check your connection and try again after the wait period. If this continues, contact support.';
}

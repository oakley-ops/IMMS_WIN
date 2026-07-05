import { describe, it, expect, vi, afterEach } from 'vitest';

const { initSentry } = require('./sentry');

describe('initSentry (MCS)', () => {
  const OLD = process.env.SENTRY_DSN;
  afterEach(() => { if (OLD === undefined) delete process.env.SENTRY_DSN; else process.env.SENTRY_DSN = OLD; });

  it('no-ops and returns false without SENTRY_DSN', () => {
    delete process.env.SENTRY_DSN;
    const sentry = { init: vi.fn() };
    expect(initSentry(sentry)).toBe(false);
    expect(sentry.init).not.toHaveBeenCalled();
  });

  it('initializes errors-only with SENTRY_DSN', () => {
    process.env.SENTRY_DSN = 'https://k@o0.ingest.sentry.io/0';
    const sentry = { init: vi.fn() };
    expect(initSentry(sentry)).toBe(true);
    expect(sentry.init).toHaveBeenCalledTimes(1);
    expect(sentry.init.mock.calls[0][0].tracesSampleRate).toBe(0);
  });
});

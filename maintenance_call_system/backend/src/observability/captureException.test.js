import { describe, it, expect, vi, afterEach } from 'vitest';
const { initSentry, captureException } = require('./sentry');

describe('captureException (MCS)', () => {
  const OLD = process.env.SENTRY_DSN;
  afterEach(() => { if (OLD === undefined) delete process.env.SENTRY_DSN; else process.env.SENTRY_DSN = OLD; });

  it('no-ops when Sentry is not enabled', () => {
    const sentry = { captureException: vi.fn() };
    captureException(new Error('x'), sentry);
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('forwards the error once Sentry is enabled', () => {
    process.env.SENTRY_DSN = 'https://k@o0.ingest.sentry.io/0';
    initSentry({ init: vi.fn() });
    const sentry = { captureException: vi.fn() };
    const err = new Error('boom');
    captureException(err, sentry);
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).toHaveBeenCalledWith(err);
  });
});

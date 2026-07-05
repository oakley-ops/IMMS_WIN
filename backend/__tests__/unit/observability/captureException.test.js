const { initSentry, captureException } = require('../../../src/observability/sentry');

describe('captureException', () => {
  const OLD = process.env.SENTRY_DSN;
  afterEach(() => { if (OLD === undefined) delete process.env.SENTRY_DSN; else process.env.SENTRY_DSN = OLD; });

  // Runs first, before any initSentry() call flips the module `enabled` flag.
  test('no-op when Sentry is not enabled', () => {
    const sentry = { captureException: jest.fn() };
    captureException(new Error('x'), sentry);
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  test('forwards the error once Sentry is enabled', () => {
    process.env.SENTRY_DSN = 'https://k@o0.ingest.sentry.io/0';
    initSentry({ init: jest.fn() }); // flips module `enabled` true
    const sentry = { captureException: jest.fn() };
    const err = new Error('boom');
    captureException(err, sentry);
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).toHaveBeenCalledWith(err);
  });

  test('does not throw when the client capture throws', () => {
    process.env.SENTRY_DSN = 'https://k@o0.ingest.sentry.io/0';
    initSentry({ init: jest.fn() });
    const sentry = { captureException: jest.fn(() => { throw new Error('sentry down'); }) };
    expect(() => captureException(new Error('x'), sentry)).not.toThrow();
  });
});

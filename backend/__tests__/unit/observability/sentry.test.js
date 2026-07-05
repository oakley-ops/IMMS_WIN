jest.mock('@sentry/node', () => ({ init: jest.fn(), setupExpressErrorHandler: jest.fn() }));
const Sentry = require('@sentry/node');
const { initSentry } = require('../../../src/observability/sentry');

describe('initSentry', () => {
  beforeEach(() => { jest.clearAllMocks(); delete process.env.SENTRY_DSN; });

  test('no-op and returns false when SENTRY_DSN is unset', () => {
    expect(initSentry()).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  test('initializes errors-only and returns true when SENTRY_DSN is set', () => {
    process.env.SENTRY_DSN = 'https://k@o0.ingest.sentry.io/0';
    expect(initSentry()).toBe(true);
    expect(Sentry.init).toHaveBeenCalledTimes(1);
    expect(Sentry.init.mock.calls[0][0]).toMatchObject({ tracesSampleRate: 0 });
    delete process.env.SENTRY_DSN;
  });

  test('returns false (does not throw) when init throws', () => {
    process.env.SENTRY_DSN = 'bad';
    Sentry.init.mockImplementationOnce(() => { throw new Error('bad dsn'); });
    expect(initSentry()).toBe(false);
    delete process.env.SENTRY_DSN;
  });
});

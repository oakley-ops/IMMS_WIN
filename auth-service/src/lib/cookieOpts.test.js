// src/lib/cookieOpts.test.js
//
// Security fix: cookie `secure` flag must default to TRUE.
// It should only be false when COOKIE_SECURE is explicitly set to 'false'.

import { cookieOpts } from './cookieOpts';

describe('cookieOpts – secure flag default', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('secure is true when COOKIE_SECURE is not set', () => {
    vi.stubEnv('COOKIE_SECURE', '');
    expect(cookieOpts().secure).toBe(true);
  });

  it('secure is true when COOKIE_SECURE is set to "true"', () => {
    vi.stubEnv('COOKIE_SECURE', 'true');
    expect(cookieOpts().secure).toBe(true);
  });

  it('secure is false only when COOKIE_SECURE is explicitly "false"', () => {
    vi.stubEnv('COOKIE_SECURE', 'false');
    expect(cookieOpts().secure).toBe(false);
  });

  it('cookie is always httpOnly', () => {
    expect(cookieOpts().httpOnly).toBe(true);
  });
});

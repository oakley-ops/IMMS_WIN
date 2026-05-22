// src/lib/errors.test.js
const { DomainError } = require('./errors');

describe('DomainError', () => {
  it('captures code, message, status, and optional details', () => {
    const err = new DomainError('unauthorized', 'Bad creds', 401, { hint: 'try again' });
    expect(err.code).toBe('unauthorized');
    expect(err.message).toBe('Bad creds');
    expect(err.status).toBe(401);
    expect(err.details).toEqual({ hint: 'try again' });
    expect(err instanceof Error).toBe(true);
  });

  it('defaults details to undefined', () => {
    const err = new DomainError('not_found', 'Missing', 404);
    expect(err.details).toBeUndefined();
  });
});

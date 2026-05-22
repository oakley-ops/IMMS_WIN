// src/lib/password.test.js
const { hash, verify } = require('./password');

describe('password', () => {
  it('hash() returns a non-empty string different from the input', async () => {
    const h = await hash('hunter2');
    expect(typeof h).toBe('string');
    expect(h.length).toBeGreaterThan(20);
    expect(h).not.toBe('hunter2');
  });

  it('verify() returns true for the correct password', async () => {
    const h = await hash('hunter2');
    expect(await verify('hunter2', h)).toBe(true);
  });

  it('verify() returns false for the wrong password', async () => {
    const h = await hash('hunter2');
    expect(await verify('wrong', h)).toBe(false);
  });
});

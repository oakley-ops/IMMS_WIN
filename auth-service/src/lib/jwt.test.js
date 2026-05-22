// src/lib/jwt.test.js
const crypto = require('crypto');

// Generate an in-memory keypair and stub the config/keys module BEFORE require.
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding:  { type: 'spki',  format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

vi.mock('../config/keys', () => ({ privateKey, publicKey }));

const { sign, verify } = require('./jwt');

describe('jwt', () => {
  it('signs and verifies a token round-trip', () => {
    const token = sign({ sub: 1, tenant_id: 1, roles: ['mcs.admin'] });
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const payload = verify(token);
    expect(payload.sub).toBe(1);
    expect(payload.tenant_id).toBe(1);
    expect(payload.roles).toEqual(['mcs.admin']);
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('verify() throws on a tampered token', () => {
    const token = sign({ sub: 1, tenant_id: 1, roles: [] });
    const [h, p, s] = token.split('.');
    const tampered = `${h}.${p}.${s.slice(0, -2)}xx`;
    expect(() => verify(tampered)).toThrow();
  });

  it('verify() throws on a token signed by a different key', () => {
    const { privateKey: otherKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding:  { type: 'spki',  format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const jwt = require('jsonwebtoken');
    const evil = jwt.sign({ sub: 9 }, otherKey, { algorithm: 'RS256' });
    expect(() => verify(evil)).toThrow();
  });
});

// scripts/generate-keys.js
// Generates a 2048-bit RSA keypair into ./keys/{private,public}.pem.
// Refuses to overwrite existing keys (rotate intentionally).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const keysDir = path.join(__dirname, '..', 'keys');
const privatePath = path.join(keysDir, 'private.pem');
const publicPath = path.join(keysDir, 'public.pem');

if (fs.existsSync(privatePath) || fs.existsSync(publicPath)) {
  console.error('Keys already exist. Delete keys/*.pem first to rotate.');
  process.exit(1);
}

fs.mkdirSync(keysDir, { recursive: true });

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding:  { type: 'spki',  format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

fs.writeFileSync(privatePath, privateKey, { mode: 0o600 });
fs.writeFileSync(publicPath,  publicKey,  { mode: 0o644 });

console.log(`Wrote ${privatePath}`);
console.log(`Wrote ${publicPath}`);

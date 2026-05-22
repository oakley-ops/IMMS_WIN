// src/config/keys.js
const fs = require('fs');
const path = require('path');

const resolve = (envVar, fallback) =>
  path.isAbsolute(process.env[envVar] || '')
    ? process.env[envVar]
    : path.join(process.cwd(), process.env[envVar] || fallback);

const privatePath = resolve('JWT_PRIVATE_KEY_PATH', './keys/private.pem');
const publicPath  = resolve('JWT_PUBLIC_KEY_PATH',  './keys/public.pem');

const readOrThrow = (p, kind) => {
  if (!fs.existsSync(p)) {
    throw new Error(`Missing ${kind} key at ${p}. Run \`npm run keys\` first.`);
  }
  return fs.readFileSync(p, 'utf8');
};

module.exports = {
  privateKey: readOrThrow(privatePath, 'private'),
  publicKey:  readOrThrow(publicPath,  'public'),
};

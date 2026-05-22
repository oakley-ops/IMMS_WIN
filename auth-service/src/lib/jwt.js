// src/lib/jwt.js
const jwt = require('jsonwebtoken');
const { privateKey, publicKey } = require('../config/keys');

const TTL_SECONDS = parseInt(process.env.TOKEN_TTL_SECONDS || '86400', 10);

const sign = (payload) =>
  jwt.sign(payload, privateKey, { algorithm: 'RS256', expiresIn: TTL_SECONDS });

const verify = (token) =>
  jwt.verify(token, publicKey, { algorithms: ['RS256'] });

module.exports = { sign, verify, TTL_SECONDS };

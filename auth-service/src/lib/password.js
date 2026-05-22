// src/lib/password.js
const bcrypt = require('bcrypt');

const ROUNDS = 12;

const hash = (plaintext) => bcrypt.hash(plaintext, ROUNDS);
const verify = (plaintext, hashed) => bcrypt.compare(plaintext, hashed);

module.exports = { hash, verify };

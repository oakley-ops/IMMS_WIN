// src/lib/cookieOpts.js
// Cookie options for the fiserv_auth JWT cookie.
//
// `secure` defaults to TRUE. To disable (local HTTP dev only), set
// COOKIE_SECURE=false in your .env file.

const { TTL_SECONDS } = require('./jwt');

const cookieOpts = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure:   process.env.COOKIE_SECURE !== 'false',
  domain:   process.env.COOKIE_DOMAIN || undefined,
  maxAge:   TTL_SECONDS * 1000,
  path:     '/',
});

module.exports = { cookieOpts };

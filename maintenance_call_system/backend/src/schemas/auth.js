const { z } = require('zod');

const loginBody = z.object({
  username: z.string().trim().min(1).max(128),
  password: z.string().min(1).max(256),
});

module.exports = { loginBody };

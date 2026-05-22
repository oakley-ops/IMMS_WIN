// src/schemas/auth.js
const { z } = require('zod');

const loginSchema = z.object({
  email:    z.string().email().max(254),
  password: z.string().min(1).max(200),
  tenant_slug: z.string().min(1).max(64).optional(),
});

module.exports = { loginSchema };

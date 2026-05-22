// src/schemas/adminUsers.js
const { z } = require('zod');

const ROLE_KEYS = [
  'imms.viewer', 'imms.user', 'imms.admin',
  'mcs.viewer', 'mcs.tech', 'mcs.admin',
];

const createUserSchema = z.object({
  email:        z.string().email().max(254),
  display_name: z.string().min(1).max(120),
  password:     z.string().min(8).max(200),
  roles:        z.array(z.enum(ROLE_KEYS)).default([]),
});

const updateUserSchema = z.object({
  display_name: z.string().min(1).max(120).optional(),
  status:       z.enum(['active', 'disabled']).optional(),
  roles:        z.array(z.enum(ROLE_KEYS)).optional(),
  password:     z.string().min(8).max(200).optional(),
});

const idParamsSchema = z.object({
  userId: z.coerce.number().int().positive(),
});

module.exports = { createUserSchema, updateUserSchema, idParamsSchema, ROLE_KEYS };

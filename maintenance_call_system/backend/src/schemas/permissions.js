const { z } = require('zod');

// All keys optional — PUT body is a partial update; omitted keys are unchanged.
const updatePermissionsBody = z.object({
  badges_add:       z.boolean().optional(),
  readers_manage:   z.boolean().optional(),
  calls_manage:     z.boolean().optional(),
  analytics_view:   z.boolean().optional(),
  skilled_operator: z.boolean().optional(),
}).strict();

const userIdParam = z.object({
  userId: z.string().regex(/^\d+$/, 'userId must be a positive integer'),
});

module.exports = { updatePermissionsBody, userIdParam };

const { z } = require('zod');

// ─── Shared primitives ──────────────────────────────────────────────────────
const nonEmptyString = z.string().trim().min(1);
const idParam = z.object({
  id: z.string().regex(/^\d+$/, 'id must be a positive integer'),
});

// ─── Badge swipe (kiosk) ────────────────────────────────────────────────────
const badgeSwipeBody = z.object({
  badge_id: nonEmptyString.max(64),
  reader_key: nonEmptyString.max(64),
});

// ─── Resolve ────────────────────────────────────────────────────────────────
const resolveBody = z.object({
  resolution_notes: nonEmptyString.max(2000),
  reason_category: z.string().max(64).optional().nullable(),
  problem_description: z.string().max(2000).optional().nullable(),
});

// ─── Suspend ────────────────────────────────────────────────────────────────
const suspendBody = z.object({
  suspension_notes: z.string().max(2000).optional().nullable(),
});

// ─── Parts ──────────────────────────────────────────────────────────────────
const partUsedItem = z.object({
  part_id: z.number().int().positive(),
  part_name: nonEmptyString.max(256),
  part_number: z.string().max(128).optional().nullable(),
  quantity: z.number().int().positive().max(10000).optional(),
});

const logPartsBody = z.object({
  parts: z.array(partUsedItem).min(1).max(50),
});

const partsSearchQuery = z.object({
  q: z.string().max(128).optional(),
});

// ─── Call list filters ──────────────────────────────────────────────────────
const callListQuery = z.object({
  status: z.enum(['open', 'in_progress', 'suspended', 'resolved']).optional(),
  machine_id: z.string().regex(/^\d+$/).optional(),
  shift_name: z.string().max(64).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

// ─── Admin: badges ──────────────────────────────────────────────────────────
const createBadgeBody = z.object({
  badge_id: nonEmptyString.max(64),
  person_name: nonEmptyString.max(128),
  role: z.enum(['operator', 'technician']),
  technician_id: z.number().int().positive().optional().nullable(),
});

const updateBadgeBody = z.object({
  person_name: z.string().max(128).optional(),
  role: z.enum(['operator', 'technician']).optional(),
  technician_id: z.number().int().positive().optional().nullable(),
  active: z.boolean().optional(),
});

// ─── Admin: readers ─────────────────────────────────────────────────────────
const createReaderBody = z.object({
  reader_key: nonEmptyString.max(64),
  machine_id: z.number().int().positive(),
  location_label: z.string().max(128).optional().nullable(),
});

const updateReaderBody = z.object({
  reader_key: z.string().max(64).optional(),
  machine_id: z.number().int().positive().optional(),
  location_label: z.string().max(128).optional().nullable(),
  active: z.boolean().optional(),
});

// ─── Metrics query ──────────────────────────────────────────────────────────
// Accepts either ISO date (YYYY-MM-DD) or full ISO datetime so the analytics
// UI date picker can pass dates directly.
const isoDateOrDatetime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/, 'must be ISO date or datetime');

const metricsQuery = z.object({
  from: isoDateOrDatetime.optional(),
  to: isoDateOrDatetime.optional(),
  shift_name: z.string().max(64).optional(),
  machine_id: z.string().regex(/^\d+$/).optional(),
  reason: z.enum(['mechanical', 'electrical', 'tooling', 'material', 'operator_error', 'other']).optional(),
});

module.exports = {
  idParam,
  badgeSwipeBody,
  resolveBody,
  suspendBody,
  logPartsBody,
  partsSearchQuery,
  callListQuery,
  createBadgeBody,
  updateBadgeBody,
  createReaderBody,
  updateReaderBody,
  metricsQuery,
};

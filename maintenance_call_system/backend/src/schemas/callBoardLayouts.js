const { z } = require('zod');

const idParam = z.object({
  id: z.string().regex(/^\d+$/, 'id must be a positive integer'),
});

const orientation = z.enum(['landscape', 'portrait']);

const createLayoutBody = z.object({
  name: z.string().trim().min(1).max(100),
  orientation: orientation.optional(),
  grid_cols: z.number().int().min(1).max(48).optional(),
  grid_rows: z.number().int().min(1).max(48).optional(),
  is_default: z.boolean().optional(),
});

const updateLayoutBody = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  orientation: orientation.optional(),
  grid_cols: z.number().int().min(1).max(48).optional(),
  grid_rows: z.number().int().min(1).max(48).optional(),
  is_default: z.boolean().optional(),
});

const tileItem = z.object({
  machine_id: z.number().int().positive(),
  col_start: z.number().int().min(0),
  row_start: z.number().int().min(0),
  col_span:  z.number().int().min(1),
  row_span:  z.number().int().min(1),
});

const saveTilesBody = z.object({
  tiles: z.array(tileItem).max(500),
});

module.exports = {
  idParam,
  createLayoutBody,
  updateLayoutBody,
  saveTilesBody,
};

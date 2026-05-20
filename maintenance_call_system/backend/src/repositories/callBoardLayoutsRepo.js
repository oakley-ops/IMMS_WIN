// Repository for call_board_layouts and call_board_tiles.
// All SQL for these tables lives here. No HTTP, no business logic.

const listLayouts = async (db) => {
  const result = await db.query(`
    SELECT layout_id, name, orientation, grid_cols, grid_rows, is_default,
           created_at, updated_at
      FROM call_board_layouts
     ORDER BY is_default DESC, name ASC
  `);
  return result.rows;
};

const findLayoutById = async (db, layoutId) => {
  const result = await db.query(
    `SELECT * FROM call_board_layouts WHERE layout_id = $1`,
    [layoutId]
  );
  return result.rows[0];
};

const findDefaultLayout = async (db) => {
  const result = await db.query(
    `SELECT * FROM call_board_layouts WHERE is_default = true LIMIT 1`
  );
  return result.rows[0];
};

const listTilesForLayout = async (db, layoutId) => {
  const result = await db.query(`
    SELECT t.tile_id, t.machine_id, t.col_start, t.row_start, t.col_span, t.row_span,
           m.name AS machine_name
      FROM call_board_tiles t
      LEFT JOIN machines m ON m.machine_id = t.machine_id
     WHERE t.layout_id = $1
     ORDER BY t.row_start, t.col_start
  `, [layoutId]);
  return result.rows;
};

// Clear is_default on all other layouts (run inside a transaction).
const clearDefaultFlag = async (db, exceptLayoutId = null) => {
  if (exceptLayoutId === null) {
    await db.query(`UPDATE call_board_layouts SET is_default = false WHERE is_default = true`);
  } else {
    await db.query(
      `UPDATE call_board_layouts SET is_default = false
        WHERE is_default = true AND layout_id <> $1`,
      [exceptLayoutId]
    );
  }
};

const insertLayout = async (db, { name, orientation, gridCols, gridRows, isDefault }) => {
  const result = await db.query(
    `INSERT INTO call_board_layouts (name, orientation, grid_cols, grid_rows, is_default)
     VALUES ($1, COALESCE($2,'landscape'), COALESCE($3,12), COALESCE($4,8), COALESCE($5,false))
     RETURNING *`,
    [name, orientation, gridCols, gridRows, isDefault]
  );
  return result.rows[0];
};

const updateLayoutMeta = async (db, layoutId, { name, orientation, gridCols, gridRows, isDefault }) => {
  const result = await db.query(
    `UPDATE call_board_layouts
        SET name        = COALESCE($1, name),
            orientation = COALESCE($2, orientation),
            grid_cols   = COALESCE($3, grid_cols),
            grid_rows   = COALESCE($4, grid_rows),
            is_default  = COALESCE($5, is_default),
            updated_at  = NOW()
      WHERE layout_id = $6
     RETURNING *`,
    [name, orientation, gridCols, gridRows, isDefault, layoutId]
  );
  return result.rows[0];
};

const deleteLayout = async (db, layoutId) => {
  const result = await db.query(
    `DELETE FROM call_board_layouts WHERE layout_id = $1 RETURNING layout_id`,
    [layoutId]
  );
  return result.rows[0];
};

const replaceLayoutTiles = async (db, layoutId, tiles) => {
  await db.query(`DELETE FROM call_board_tiles WHERE layout_id = $1`, [layoutId]);
  for (const t of tiles) {
    await db.query(
      `INSERT INTO call_board_tiles
         (layout_id, machine_id, col_start, row_start, col_span, row_span)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [layoutId, t.machine_id, t.col_start, t.row_start, t.col_span, t.row_span]
    );
  }
  await db.query(
    `UPDATE call_board_layouts SET updated_at = NOW() WHERE layout_id = $1`,
    [layoutId]
  );
};

module.exports = {
  listLayouts,
  findLayoutById,
  findDefaultLayout,
  listTilesForLayout,
  clearDefaultFlag,
  insertLayout,
  updateLayoutMeta,
  deleteLayout,
  replaceLayoutTiles,
};

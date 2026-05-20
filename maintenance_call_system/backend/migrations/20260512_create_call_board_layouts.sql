-- Persisted layouts for the maintenance call board.
-- Each layout is a named grid (cols x rows) with an orientation and a set of
-- machine tiles positioned on it.

CREATE TABLE IF NOT EXISTS call_board_layouts (
  layout_id    SERIAL PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  orientation  VARCHAR(10)  NOT NULL DEFAULT 'landscape'
               CHECK (orientation IN ('landscape', 'portrait')),
  grid_cols    INTEGER      NOT NULL DEFAULT 12 CHECK (grid_cols BETWEEN 1 AND 48),
  grid_rows    INTEGER      NOT NULL DEFAULT 8  CHECK (grid_rows BETWEEN 1 AND 48),
  is_default   BOOLEAN      NOT NULL DEFAULT false,
  created_at   TIMESTAMP    DEFAULT NOW(),
  updated_at   TIMESTAMP    DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_call_board_layouts_one_default
  ON call_board_layouts (is_default) WHERE is_default = true;

CREATE TABLE IF NOT EXISTS call_board_tiles (
  tile_id     SERIAL  PRIMARY KEY,
  layout_id   INTEGER NOT NULL REFERENCES call_board_layouts(layout_id) ON DELETE CASCADE,
  machine_id  INTEGER NOT NULL REFERENCES machines(machine_id)          ON DELETE CASCADE,
  col_start   INTEGER NOT NULL CHECK (col_start >= 0),
  row_start   INTEGER NOT NULL CHECK (row_start >= 0),
  col_span    INTEGER NOT NULL DEFAULT 2 CHECK (col_span  >= 1),
  row_span    INTEGER NOT NULL DEFAULT 2 CHECK (row_span  >= 1),
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE (layout_id, machine_id)
);

CREATE INDEX IF NOT EXISTS idx_call_board_tiles_layout ON call_board_tiles(layout_id);

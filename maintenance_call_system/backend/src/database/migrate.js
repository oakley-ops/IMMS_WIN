// Tracked SQL migration runner for the MCS backend.
//
//   node src/database/migrate.js              apply pending migrations/*.sql
//   node src/database/migrate.js --baseline   record pending files WITHOUT executing
//                                             (one-time cutover step: the live DB already
//                                              has every current migration applied by hand)
//
// Files apply in filename order; each file runs inside its own transaction and
// is recorded in mcs_schema_migrations so it never runs twice.
const fs = require('fs');
const path = require('path');

const DEFAULT_DIR = path.join(__dirname, '..', '..', 'migrations');

const runMigrations = async (db, { dir = DEFAULT_DIR, baseline = false } = {}) => {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const client = await db.getClient();
  const applied = [];
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS mcs_schema_migrations (
        filename   TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const done = await client.query('SELECT filename FROM mcs_schema_migrations');
    const doneSet = new Set(done.rows.map((r) => r.filename));

    for (const file of files) {
      if (doneSet.has(file)) continue;
      if (baseline) {
        await client.query('INSERT INTO mcs_schema_migrations (filename) VALUES ($1)', [file]);
        applied.push(file);
        continue;
      }
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO mcs_schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        applied.push(file);
      } catch (err) {
        await client.query('ROLLBACK');
        err.message = `Migration ${file} failed: ${err.message}`;
        throw err;
      }
    }
    return { applied, skipped: files.length - applied.length };
  } finally {
    client.release();
  }
};

module.exports = { runMigrations };

if (require.main === module) {
  const db = require('./db');
  const baseline = process.argv.includes('--baseline');
  runMigrations(db, { baseline })
    .then(({ applied, skipped }) => {
      const verb = baseline ? 'baselined' : 'applied';
      console.log(`${verb}: ${applied.length ? applied.join(', ') : '(none)'} | already recorded: ${skipped}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}

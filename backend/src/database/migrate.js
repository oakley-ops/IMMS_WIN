// Tracked SQL migration runner for the IMMS backend.
//
//   node src/database/migrate.js              apply pending migrations/*.sql
//   node src/database/migrate.js --baseline   record pending files WITHOUT executing
//                                             (one-time step: the live DB already has
//                                              every current migration applied by hand)
//   node src/database/migrate.js --force      apply even when the first-run guard trips
//
// Files apply in filename order; each runs in its own transaction and is recorded
// in imms_schema_migrations so it never runs twice. A first-run guard refuses to
// apply when nothing is recorded yet and many files are pending (an existing DB
// that hasn't been baselined), unless --force is given.
const fs = require('fs');
const path = require('path');

const DEFAULT_DIR = path.join(__dirname, '..', '..', 'migrations');
const GUARD_THRESHOLD = 5;

const runMigrations = async (db, { dir = DEFAULT_DIR, baseline = false, force = false } = {}) => {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const client = await db.getClient();
  const applied = [];
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS imms_schema_migrations (
        filename   TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const done = await client.query('SELECT filename FROM imms_schema_migrations');
    const doneSet = new Set(done.rows.map((r) => r.filename));
    const pending = files.filter((f) => !doneSet.has(f));

    // First-run guard: an existing DB (nothing recorded) with many pending files
    // almost certainly already has them applied by hand — refuse to re-run them.
    if (!baseline && !force && doneSet.size === 0 && pending.length > GUARD_THRESHOLD) {
      throw new Error(
        `Existing database detected (${pending.length} pending, none recorded) — ` +
        `run "npm run migrate:baseline" first, or pass --force to apply all.`
      );
    }

    if (baseline) {
      // Atomic: record all pending files in one transaction so an interrupted
      // baseline can't leave a partial set (which would defeat the first-run guard).
      try {
        await client.query('BEGIN');
        for (const file of pending) {
          await client.query('INSERT INTO imms_schema_migrations (filename) VALUES ($1)', [file]);
          applied.push(file);
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
      return { applied, skipped: files.length - applied.length };
    }

    for (const file of pending) {
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO imms_schema_migrations (filename) VALUES ($1)', [file]);
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
  require('dotenv').config();
  const db = require('../../db');
  const baseline = process.argv.includes('--baseline');
  const force = process.argv.includes('--force');
  runMigrations(db, { baseline, force })
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

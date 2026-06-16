// Usage: node migrations/apply-one.js <relative-or-absolute-sql-file>
// The dated .sql migrations are NOT run by `npm run migrate` (that only applies
// db/schema.sql once); this helper applies a single SQL file against DATABASE_URL.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const file = process.argv[2];
if (!file) { console.error('Usage: node migrations/apply-one.js <file.sql>'); process.exit(1); }
const sql = fs.readFileSync(path.resolve(file), 'utf8');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(sql)
  .then(() => { console.log(`Applied ${file}`); return pool.end(); })
  .catch((e) => { console.error(`Failed ${file}:`, e.message); pool.end(); process.exit(1); });

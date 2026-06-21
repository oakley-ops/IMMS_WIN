require('dotenv').config();
const { pool } = require('../../db');
const { reindexAll } = require('../services/search/searchIndexer');

async function run() {
  const tenantId = parseInt(process.argv[2], 10) || 1;
  console.log(`Reindexing search for tenant ${tenantId}...`);
  try {
    const n = await reindexAll(tenantId);
    console.log(`✅ Indexed ${n} parts`);
  } catch (e) {
    console.error('❌ reindex failed:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
run();

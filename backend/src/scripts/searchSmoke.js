// Real-model end-to-end smoke for hybrid search (run under plain node, NOT jest —
// @xenova/transformers is ESM and won't load under jest's transform).
// Usage: node src/scripts/searchSmoke.js ["query one" "query two" ...]
require('dotenv').config();
const { pool } = require('../../db');
const { search } = require('../services/search/searchService');

const QUERIES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['shaft bearing', 'blade for peeling hotstamp', 'green belt'];

(async () => {
  for (const q of QUERIES) {
    const r = await search({ q, tenantId: 1, limit: 5 });
    console.log(`\n# "${q}"  (degraded=${JSON.stringify(r.degraded)})`);
    r.results.forEach((x, i) => console.log(`  ${i + 1}. [${x.part_id}] ${x.name}`));
  }
  await pool.end();
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});

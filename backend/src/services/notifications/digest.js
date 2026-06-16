const { EVENTS } = require('./config');

async function buildDigest(pool) {
  const { rows } = await pool.query(
    `SELECT part_id, name, quantity, minimum_quantity,
            CASE WHEN quantity = 0 THEN 'out' ELSE 'low' END AS kind
     FROM parts
     WHERE status = 'active' AND quantity <= minimum_quantity
     ORDER BY quantity ASC, name ASC`
  );
  return {
    outParts: rows.filter(r => r.kind === 'out'),
    lowParts: rows.filter(r => r.kind === 'low'),
  };
}

async function sendDigest(pool, notificationService) {
  const digest = await buildDigest(pool);
  if (digest.outParts.length === 0 && digest.lowParts.length === 0) return;
  await notificationService.notify(EVENTS.INVENTORY_DIGEST, digest);
}

module.exports = { buildDigest, sendDigest };

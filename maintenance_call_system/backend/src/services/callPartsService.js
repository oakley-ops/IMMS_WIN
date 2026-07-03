// Cross-app write: after logging parts used on a call, best-effort decrement
// the same quantity in IMMS (which owns `parts`/`transactions`) by calling
// its existing unauthenticated POST /parts/usage endpoint. IMMS and MCS never
// share a DB transaction, so each part's decrement succeeds or fails
// independently of the call-parts log — callers surface `inventory[]` to the
// user rather than treating a decrement failure as a request failure.
const { IMMS_API_URL } = require('../config/imms');
const repo = require('../repositories/maintenanceCallsRepo');

const USAGE_TIMEOUT_MS = 3000;

const decrementImmsPart = async ({ part_id, quantity, callId }) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), USAGE_TIMEOUT_MS);
  try {
    const res = await fetch(`${IMMS_API_URL}/parts/usage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        part_id,
        quantity,
        reason: 'Maintenance call resolution',
        work_order_number: `MC-${callId}`,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { part_id, decremented: false, error: body.error || `IMMS returned ${res.status}` };
    }
    return { part_id, decremented: true };
  } catch (err) {
    const error = err.name === 'AbortError' ? 'IMMS request timed out' : err.message;
    return { part_id, decremented: false, error };
  } finally {
    clearTimeout(timer);
  }
};

const logCallParts = async (db, callId, parts) => {
  const rows = await repo.insertCallParts(db, callId, parts);
  const inventory = await Promise.all(
    parts.map((p) => decrementImmsPart({ part_id: p.part_id, quantity: p.quantity || 1, callId }))
  );
  return { parts: rows, inventory };
};

module.exports = { logCallParts, decrementImmsPart };

const { EVENTS } = require('./config');

const SEVERITY = { in_stock: 0, low_stock: 1, out_of_stock: 2 };

function statusFor(part) {
  if (Number(part.quantity) === 0) return 'out_of_stock';
  if (Number(part.quantity) <= Number(part.minimum_quantity)) return 'low_stock';
  return 'in_stock';
}

// parts: [{part_id, quantity, minimum_quantity, ...}], prevMap: Map<part_id, last_status>
function computeAlerts(parts, prevMap) {
  const events = [];
  const newStates = [];
  for (const part of parts) {
    const current = statusFor(part);
    const last = prevMap.get(part.part_id) || 'in_stock';
    if (SEVERITY[current] > SEVERITY[last]) {
      events.push({
        part,
        eventType: current === 'out_of_stock' ? EVENTS.INVENTORY_OUT : EVENTS.INVENTORY_LOW,
      });
    }
    newStates.push({ part_id: part.part_id, status: current });
  }
  return { events, newStates };
}

module.exports = { statusFor, computeAlerts };

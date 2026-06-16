const { EVENTS } = require('./config');

const li = (label, val) => `<li><strong>${label}:</strong> ${val == null ? 'N/A' : val}</li>`;
const partRows = (parts) => parts.map(p =>
  `<tr><td>${p.name}</td><td>${p.quantity}</td><td>${p.minimum_quantity}</td></tr>`).join('');

const EMAIL = {
  [EVENTS.INVENTORY_LOW]: (p) => ({
    subject: `Low Stock Alert: ${p.name}`,
    html: `<h2>Low Stock Alert</h2><ul>${li('Part', p.name)}${li('On hand', p.quantity)}${li('Minimum', p.minimum_quantity)}</ul>`,
  }),
  [EVENTS.INVENTORY_OUT]: (p) => ({
    subject: `Out of Stock Alert: ${p.name}`,
    html: `<h2>Out of Stock Alert</h2><ul>${li('Part', p.name)}${li('Minimum', p.minimum_quantity)}</ul><p>Please reorder.</p>`,
  }),
  [EVENTS.INVENTORY_DIGEST]: (d) => ({
    subject: `Daily Inventory Alert Digest (${d.outParts.length} out, ${d.lowParts.length} low)`,
    html: `<h2>Inventory Status Digest</h2>
      <h3>Out of Stock (${d.outParts.length})</h3>
      <table><tr><th>Part</th><th>Qty</th><th>Min</th></tr>${partRows(d.outParts)}</table>
      <h3>Low Stock (${d.lowParts.length})</h3>
      <table><tr><th>Part</th><th>Qty</th><th>Min</th></tr>${partRows(d.lowParts)}</table>`,
  }),
  [EVENTS.PO_SUBMITTED]: (po) => ({ subject: `PO ${po.po_number} submitted`, html: `<p>Purchase order <strong>${po.po_number}</strong> was submitted for approval.</p>` }),
  [EVENTS.PO_APPROVED]: (po) => ({ subject: `PO ${po.po_number} approved`, html: `<p>Purchase order <strong>${po.po_number}</strong> was approved.</p>` }),
  [EVENTS.PO_RECEIVED]: (po) => ({ subject: `PO ${po.po_number} received`, html: `<p>Purchase order <strong>${po.po_number}</strong> was marked received.</p>` }),
  [EVENTS.PO_ON_HOLD]: (po) => ({ subject: `PO ${po.po_number} on hold`, html: `<p>Purchase order <strong>${po.po_number}</strong> was put on hold.</p>` }),
  [EVENTS.PO_REJECTED]: (po) => ({ subject: `PO ${po.po_number} rejected`, html: `<p>Purchase order <strong>${po.po_number}</strong> was rejected.</p>` }),
};

const SMS = {
  [EVENTS.INVENTORY_OUT]: (p) => `IMMS: OUT OF STOCK — ${p.name}. Please reorder.`,
  [EVENTS.PO_APPROVED]: (po) => `IMMS: PO ${po.po_number} APPROVED.`,
  [EVENTS.PO_ON_HOLD]: (po) => `IMMS: PO ${po.po_number} ON HOLD.`,
  [EVENTS.PO_REJECTED]: (po) => `IMMS: PO ${po.po_number} REJECTED.`,
};

function renderEmail(eventType, payload) {
  const fn = EMAIL[eventType];
  if (!fn) throw new Error(`No email template for ${eventType}`);
  return fn(payload);
}
function renderSms(eventType, payload) {
  const fn = SMS[eventType];
  if (!fn) throw new Error(`No SMS template for ${eventType}`);
  return fn(payload);
}

module.exports = { renderEmail, renderSms };

const crypto = require('crypto');

// part: { name, description, manufacturer_part_number, barcode,
//         supplier, location, notes }  (location is COALESCE(part_locations.name, parts.location))
function buildPartContent(part) {
  const lines = [];
  if (part.name) lines.push(part.name);
  if (part.description) lines.push(part.description);
  if (part.manufacturer_part_number) lines.push(`MPN: ${part.manufacturer_part_number}`);
  if (part.barcode) lines.push(`Barcode: ${part.barcode}`);
  if (part.supplier) lines.push(`Supplier: ${part.supplier}`);
  if (part.location) lines.push(`Location: ${part.location}`);
  if (part.notes) lines.push(`Notes: ${part.notes}`);
  return lines.join('\n');
}

function contentHash(text) {
  return crypto.createHash('sha256').update(text || '').digest('hex');
}

module.exports = { buildPartContent, contentHash };

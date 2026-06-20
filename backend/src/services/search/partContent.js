const crypto = require('crypto');

// part: { name, description, manufacturer_part_number, internal_part_number,
//         supplier, location, notes }  (location is part_locations.name)
function buildPartContent(part) {
  const lines = [];
  if (part.name) lines.push(part.name);
  if (part.description) lines.push(part.description);
  if (part.manufacturer_part_number) lines.push(`MPN: ${part.manufacturer_part_number}`);
  if (part.internal_part_number) lines.push(`PN: ${part.internal_part_number}`);
  if (part.supplier) lines.push(`Supplier: ${part.supplier}`);
  if (part.location) lines.push(`Location: ${part.location}`);
  if (part.notes) lines.push(`Notes: ${part.notes}`);
  return lines.join('\n');
}

function contentHash(text) {
  return crypto.createHash('sha256').update(text || '').digest('hex');
}

module.exports = { buildPartContent, contentHash };

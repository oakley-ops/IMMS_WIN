/**
 * Part Number Extractor
 * Extracts part numbers and clean descriptions from line item descriptions
 */

/**
 * Extract part number from item description
 * Handles various common formats:
 * - "Vendor Item # NS Glycol Super cool 30%"
 * - "Part # ABC-123 Description here"
 * - "Item: XYZ-456 Something"
 * 
 * @param {string} description - Full item description
 * @returns {Object} { partNumber, cleanDescription }
 */
function extractPartNumber(description) {
  if (!description) {
    return {
      partNumber: null,
      cleanDescription: description
    };
  }
  
  const desc = description.trim();
  
  // Pattern 1: "Item # ABC" or "Item# ABC"
  const itemPattern = /(?:Item|Part)\s*#\s*([A-Z0-9-_]+)/i;
  let match = desc.match(itemPattern);
  
  if (match) {
    const partNumber = match[1].trim();
    const cleanDescription = desc.replace(itemPattern, '').trim();
    
    return {
      partNumber,
      cleanDescription
    };
  }
  
  // Pattern 2: "Part: ABC" or "Item: ABC"
  const colonPattern = /(?:Item|Part):\s*([A-Z0-9-_]+)/i;
  match = desc.match(colonPattern);
  
  if (match) {
    const partNumber = match[1].trim();
    const cleanDescription = desc.replace(colonPattern, '').trim();
    
    return {
      partNumber,
      cleanDescription
    };
  }
  
  // Pattern 3: First word/code if it looks like a part number
  // (starts with letters/numbers, may contain dashes/underscores)
  const firstWordPattern = /^([A-Z0-9][A-Z0-9-_]{1,20})\s+(.+)$/i;
  match = desc.match(firstWordPattern);
  
  if (match) {
    const potentialPartNumber = match[1];
    const remaining = match[2];
    
    // Only use it if it looks like a part number (has letters and numbers or dashes)
    if (/[A-Z]/.test(potentialPartNumber) && (/\d/.test(potentialPartNumber) || /-/.test(potentialPartNumber))) {
      return {
        partNumber: potentialPartNumber.trim(),
        cleanDescription: remaining.trim()
      };
    }
  }
  
  // No part number found - return description as-is
  return {
    partNumber: null,
    cleanDescription: desc
  };
}

/**
 * Normalize part number for matching
 * - Remove spaces
 * - Convert to uppercase
 * - Standardize separators
 * 
 * @param {string} partNumber 
 * @returns {string} Normalized part number
 */
function normalizePartNumber(partNumber) {
  if (!partNumber) return null;
  
  return partNumber
    .toString()
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '') // Remove all spaces
    .replace(/[_]/g, '-'); // Standardize separators to dashes
}

/**
 * Generate search variations of a part number for exact matching
 * Returns array of variations to try
 * 
 * @param {string} partNumber 
 * @returns {Array<string>} Array of part number variations
 */
function generatePartNumberVariations(partNumber) {
  if (!partNumber) return [];
  
  const variations = new Set();
  const normalized = normalizePartNumber(partNumber);
  
  if (!normalized) return [];
  
  // Add normalized version
  variations.add(normalized);
  
  // Add original
  variations.add(partNumber.trim());
  
  // Add version without dashes
  variations.add(normalized.replace(/-/g, ''));
  
  // Add version with spaces instead of dashes
  variations.add(normalized.replace(/-/g, ' '));
  
  // Add lowercase versions
  variations.add(normalized.toLowerCase());
  variations.add(partNumber.trim().toLowerCase());
  
  return Array.from(variations);
}

module.exports = {
  extractPartNumber,
  normalizePartNumber,
  generatePartNumberVariations
};

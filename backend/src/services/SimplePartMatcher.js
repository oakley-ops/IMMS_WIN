/**
 * Simple Part Matcher Service
 * Matches parts by exact part number or auto-creates new parts
 * No fuzzy matching - simple and fast
 */

const { extractPartNumber, generatePartNumberVariations } = require('../utils/partNumberExtractor');

class SimplePartMatcher {
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * Find exact match for a part by manufacturer part number
   * Tries multiple variations of the part number
   * 
   * @param {string} partNumber 
   * @returns {Object|null} Matching part or null
   */
  async findExactMatch(partNumber) {
    if (!partNumber) return null;
    
    // Generate variations to try
    const variations = generatePartNumberVariations(partNumber);
    
    console.log(`Searching for part number variations:`, variations);
    
    // Try each variation
    for (const variation of variations) {
      const result = await this.pool.query(
        'SELECT * FROM parts WHERE manufacturer_part_number = $1 LIMIT 1',
        [variation]
      );
      
      if (result.rows.length > 0) {
        console.log(`Found exact match for part number: ${variation}`);
        return result.rows[0];
      }
    }
    
    console.log(`No exact match found for part number: ${partNumber}`);
    return null;
  }

  /**
   * Create a new part from PO line item
   * 
   * @param {Object} partData - Part data to create
   * @param {number} supplierId - Supplier ID to link
   * @param {string} poNumber - PO number for audit trail
   * @returns {Object} Created part
   */
  async createPart(partData, supplierId, poNumber) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      console.log(`Creating new part: ${partData.name}`);
      
      // Create the part
      const partResult = await client.query(
        `INSERT INTO parts (
          name, 
          manufacturer_part_number, 
          description, 
          unit_cost, 
          quantity, 
          minimum_quantity,
          status,
          notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
        RETURNING *`,
        [
          partData.name,
          partData.manufacturer_part_number || null,
          partData.description || `Auto-imported from PO ${poNumber}`,
          partData.unit_cost || 0,
          0, // New part, not in stock yet
          0, // Minimum quantity to be set later
          'active',
          partData.notes || `Auto-imported from PO ${poNumber} on ${new Date().toISOString()}`
        ]
      );
      
      const newPart = partResult.rows[0];
      console.log(`Created part with ID: ${newPart.part_id}`);
      
      // Link to supplier if provided
      if (supplierId) {
        await client.query(
          `INSERT INTO part_suppliers (part_id, supplier_id, is_preferred, unit_cost) 
           VALUES ($1, $2, true, $3)
           ON CONFLICT (part_id, supplier_id) DO NOTHING`,
          [newPart.part_id, supplierId, partData.unit_cost || 0]
        );
        
        console.log(`Linked part ${newPart.part_id} to supplier ${supplierId}`);
      }
      
      await client.query('COMMIT');
      
      return newPart;
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating part:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Match or create part from PO line item
   * Simple 2-tier logic: exact match or auto-create
   * 
   * @param {Object} lineItem - Line item from PO
   * @param {number} supplierId - Supplier ID
   * @param {string} poNumber - PO number for audit trail
   * @returns {Object} Result with part info and match status
   */
  async matchOrCreatePart(lineItem, supplierId, poNumber) {
    // Extract part number from description
    const { partNumber, cleanDescription } = extractPartNumber(lineItem.description);
    
    console.log(`Processing line item: "${lineItem.description}"`);
    console.log(`  Extracted part number: ${partNumber}`);
    console.log(`  Clean description: ${cleanDescription}`);
    
    // Try exact match if we have a part number
    if (partNumber) {
      const existingPart = await this.findExactMatch(partNumber);
      
      if (existingPart) {
        console.log(`  ✅ Matched to existing part: ${existingPart.name} (ID: ${existingPart.part_id})`);
        
        return {
          part_id: existingPart.part_id,
          part_name: existingPart.name,
          manufacturer_part_number: existingPart.manufacturer_part_number,
          matched: true,
          created: false,
          existing_part: existingPart
        };
      }
    }
    
    // No match found - create new part
    console.log(`  ✨ No match found - creating new part`);
    
    const newPart = await this.createPart(
      {
        name: cleanDescription || lineItem.description,
        manufacturer_part_number: partNumber,
        unit_cost: lineItem.unitPrice,
        description: lineItem.description,
        notes: `Auto-imported from PO ${poNumber}`
      },
      supplierId,
      poNumber
    );
    
    console.log(`  ✅ Created new part: ${newPart.name} (ID: ${newPart.part_id})`);
    
    return {
      part_id: newPart.part_id,
      part_name: newPart.name,
      manufacturer_part_number: newPart.manufacturer_part_number,
      matched: false,
      created: true,
      new_part: newPart
    };
  }
}

module.exports = SimplePartMatcher;

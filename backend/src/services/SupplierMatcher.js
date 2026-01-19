/**
 * Supplier Matcher Service
 * Matches suppliers by name or auto-creates new suppliers
 * Simple exact match (case-insensitive) or create
 */

class SupplierMatcher {
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * Find exact match for supplier by name (case-insensitive)
   * 
   * @param {string} name - Supplier name to search for
   * @returns {Object|null} Matching supplier or null
   */
  async findExactMatch(name) {
    if (!name) return null;
    
    const result = await this.pool.query(
      'SELECT * FROM suppliers WHERE LOWER(name) = LOWER($1) LIMIT 1',
      [name.trim()]
    );
    
    if (result.rows.length > 0) {
      console.log(`Found exact supplier match: ${result.rows[0].name}`);
      return result.rows[0];
    }
    
    console.log(`No exact supplier match found for: ${name}`);
    return null;
  }

  /**
   * Create a new supplier
   * 
   * @param {Object} vendorData - Vendor data from PDF
   * @returns {Object} Created supplier
   */
  async createSupplier(vendorData) {
    console.log(`Creating new supplier: ${vendorData.name}`);
    
    const result = await this.pool.query(
      `INSERT INTO suppliers (name, address, phone, notes)
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [
        vendorData.name,
        vendorData.address || '',
        vendorData.phone || '',
        `Auto-created from PDF import on ${new Date().toISOString()}`
      ]
    );
    
    const newSupplier = result.rows[0];
    console.log(`Created supplier with ID: ${newSupplier.supplier_id}`);
    
    return newSupplier;
  }

  /**
   * Match or create supplier from vendor data
   * Simple logic: exact match (case-insensitive) or auto-create
   * 
   * @param {Object} vendorData - Vendor data from PDF
   * @returns {Object} Result with supplier info and match status
   */
  async matchOrCreateSupplier(vendorData) {
    if (!vendorData || !vendorData.name) {
      throw new Error('Vendor name is required');
    }
    
    console.log(`Processing vendor: "${vendorData.name}"`);
    
    // Try exact match
    const existingSupplier = await this.findExactMatch(vendorData.name);
    
    if (existingSupplier) {
      console.log(`  ✅ Matched to existing supplier (ID: ${existingSupplier.supplier_id})`);
      
      return {
        supplier_id: existingSupplier.supplier_id,
        name: existingSupplier.name,
        matched: true,
        created: false,
        supplier: existingSupplier
      };
    }
    
    // No match found - create new supplier
    console.log(`  ✨ No match found - creating new supplier`);
    
    const newSupplier = await this.createSupplier(vendorData);
    
    console.log(`  ✅ Created new supplier (ID: ${newSupplier.supplier_id})`);
    
    return {
      supplier_id: newSupplier.supplier_id,
      name: newSupplier.name,
      matched: false,
      created: true,
      supplier: newSupplier
    };
  }
}

module.exports = SupplierMatcher;

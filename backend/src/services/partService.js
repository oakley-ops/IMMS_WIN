/**
 * Validates a part object
 * @param {Object} part - The part object to validate
 * @returns {boolean} - Whether the part is valid
 */
const validatePart = (part) => {
    if (!part) return false;
    
    // Check required fields
    if (!part.name || typeof part.name !== 'string' || part.name.trim() === '') {
        return false;
    }
    
    if (typeof part.quantity !== 'number' || part.quantity < 0) {
        return false;
    }
    
    // Check part numbers if provided
    if (part.manufacturer_part_number && typeof part.manufacturer_part_number !== 'string') {
        return false;
    }
    
    if (part.fiserv_part_number && typeof part.fiserv_part_number !== 'string') {
        return false;
    }
    
    return true;
};

/**
 * Calculates the total value of inventory
 * @param {Array} parts - Array of part objects with quantity and price
 * @returns {number} - Total value of inventory
 */
const calculateInventoryValue = (parts) => {
    if (!Array.isArray(parts)) return 0;
    
    return parts.reduce((total, part) => {
        if (!part.quantity || !part.price) return total;
        return total + (part.quantity * part.price);
    }, 0);
};

module.exports = {
    validatePart,
    calculateInventoryValue
}; 
const { validatePart, calculateInventoryValue } = require('../../src/services/partService');

describe('Part Service', () => {
  describe('validatePart', () => {
    test('should validate a correct part object', () => {
      const validPart = {
        name: 'Test Part',
        quantity: 10,
        manufacturer_part_number: 'MPN123',
        fiserv_part_number: 'FPN123'
      };
      expect(validatePart(validPart)).toBe(true);
    });

    test('should reject invalid part object', () => {
      const invalidPart = {
        name: '', // empty name
        quantity: -1 // negative quantity
      };
      expect(validatePart(invalidPart)).toBe(false);
    });

    test('should reject null part', () => {
      expect(validatePart(null)).toBe(false);
    });

    test('should reject part with invalid manufacturer_part_number', () => {
      const invalidPart = {
        name: 'Test Part',
        quantity: 10,
        manufacturer_part_number: 123 // should be string
      };
      expect(validatePart(invalidPart)).toBe(false);
    });
  });

  describe('calculateInventoryValue', () => {
    test('should calculate correct inventory value', () => {
      const parts = [
        { quantity: 5, price: 10 },
        { quantity: 3, price: 20 }
      ];
      const totalValue = calculateInventoryValue(parts);
      expect(totalValue).toBe(110); // (5 * 10) + (3 * 20)
    });

    test('should return 0 for empty inventory', () => {
      expect(calculateInventoryValue([])).toBe(0);
    });

    test('should handle null input', () => {
      expect(calculateInventoryValue(null)).toBe(0);
    });

    test('should skip parts without price or quantity', () => {
      const parts = [
        { quantity: 5, price: 10 },
        { quantity: 3 }, // no price
        { price: 20 }, // no quantity
        { quantity: 2, price: 15 }
      ];
      expect(calculateInventoryValue(parts)).toBe(80); // (5 * 10) + (2 * 15)
    });
  });
}); 
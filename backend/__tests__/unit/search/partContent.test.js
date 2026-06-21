const { buildPartContent, contentHash } = require('../../../src/services/search/partContent');

describe('buildPartContent', () => {
  test('joins present fields, skips nulls', () => {
    const content = buildPartContent({
      name: 'Hydraulic Fitting',
      description: '1/4" NPT brass',
      manufacturer_part_number: 'BR-14NPT',
      barcode: null,
      supplier: 'Acme',
      location: 'Bin A3',
      notes: null,
    });
    expect(content).toContain('Hydraulic Fitting');
    expect(content).toContain('MPN: BR-14NPT');
    expect(content).toContain('Supplier: Acme');
    expect(content).toContain('Location: Bin A3');
    expect(content).not.toContain('Barcode:'); // barcode was null
    expect(content).not.toContain('Notes:'); // notes was null
  });
});

describe('contentHash', () => {
  test('stable and order-sensitive', () => {
    expect(contentHash('a')).toBe(contentHash('a'));
    expect(contentHash('a')).not.toBe(contentHash('b'));
  });
});

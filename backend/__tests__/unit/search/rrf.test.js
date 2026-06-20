const { rrfFuse } = require('../../../src/services/search/rrf');

describe('rrfFuse', () => {
  test('item ranked high in both lists wins', () => {
    const lexical = [{ source_id: 1 }, { source_id: 2 }, { source_id: 3 }];
    const vector = [{ source_id: 3 }, { source_id: 1 }, { source_id: 9 }];
    const fused = rrfFuse([lexical, vector]);
    expect(fused[0].source_id).toBe(1); // appears near top of both
    expect(fused.map((f) => f.source_id)).toEqual(expect.arrayContaining([1, 2, 3, 9]));
    expect(fused.every((f, i) => i === 0 || fused[i - 1].score >= f.score)).toBe(true);
  });

  test('handles empty lists', () => {
    expect(rrfFuse([[], []])).toEqual([]);
    expect(rrfFuse([[{ source_id: 5 }], []])[0].source_id).toBe(5);
  });
});

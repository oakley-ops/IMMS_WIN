const RRF_K = 60;

// rankedLists: array of arrays of { source_id }, each ordered best-first.
// Returns [{ source_id, score }] sorted by score desc.
function rrfFuse(rankedLists, { k = RRF_K } = {}) {
  const scores = new Map();
  for (const list of rankedLists) {
    list.forEach((item, idx) => {
      const rank = idx + 1; // 1-based
      scores.set(item.source_id, (scores.get(item.source_id) || 0) + 1 / (k + rank));
    });
  }
  return [...scores.entries()]
    .map(([source_id, score]) => ({ source_id, score }))
    .sort((a, b) => b.score - a.score);
}

module.exports = { rrfFuse, RRF_K };

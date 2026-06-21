const { AutoTokenizer, AutoModelForSequenceClassification } = require('@xenova/transformers');
const { logger } = require('../../utils/logger');

const MODEL = 'Xenova/ms-marco-MiniLM-L-6-v2'; // small CPU cross-encoder

let loadPromise = null;
function load() {
  if (!loadPromise) {
    loadPromise = Promise.all([
      AutoTokenizer.from_pretrained(MODEL),
      AutoModelForSequenceClassification.from_pretrained(MODEL),
    ])
      .then(([tokenizer, model]) => ({ tokenizer, model }))
      .catch((e) => {
        loadPromise = null;
        logger.error('search.reranker load failed', { error: e.message });
        throw e;
      });
  }
  return loadPromise;
}

// Returns a relevance score per doc (higher = more relevant), same order as docs.
async function score(query, docs) {
  if (!docs.length) return [];
  const { tokenizer, model } = await load();
  const inputs = tokenizer(
    docs.map(() => query),
    { text_pair: docs, padding: true, truncation: true }
  );
  const { logits } = await model(inputs);
  return logits.tolist().map((row) => row[0]);
}

module.exports = { score, load, MODEL };

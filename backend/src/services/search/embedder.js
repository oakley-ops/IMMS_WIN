const { pipeline } = require('@xenova/transformers');
const { logger } = require('../../utils/logger');

const MODEL = 'Xenova/bge-small-en-v1.5';
const EMBED_DIM = 384;
// bge is asymmetric: queries get a retrieval instruction prefix, documents do not.
const QUERY_PREFIX = 'Represent this sentence for searching relevant passages: ';

let extractorPromise = null;
function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', MODEL).catch((e) => {
      extractorPromise = null; // allow retry on next call
      logger.error('search.embedder load failed', { error: e.message });
      throw e;
    });
  }
  return extractorPromise;
}

async function embed(text, { isQuery = false } = {}) {
  const extractor = await getExtractor();
  const input = isQuery ? QUERY_PREFIX + text : text;
  const output = await extractor(input, { pooling: 'mean', normalize: true });
  return Array.from(output.data); // length 384, L2-normalized
}

module.exports = { embed, getExtractor, EMBED_DIM, MODEL };

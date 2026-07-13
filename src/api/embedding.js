/**
 * Browser-side text embedding via Transformers.js.
 * Uses BGE-small-zh — Chinese-optimized, 512-dim vectors, ~30MB model cached by browser.
 */
import { pipeline } from '@xenova/transformers';

const MODEL_NAME = 'Xenova/bge-small-zh-v1.5';

let embedder = null;
let loadingPromise = null;

/**
 * Lazy-load the feature-extraction pipeline. Multiple callers share one promise.
 */
export async function loadEmbeddingModel() {
  if (embedder) return embedder;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    embedder = await pipeline('feature-extraction', MODEL_NAME);
    return embedder;
  })();

  return loadingPromise;
}

/**
 * Generate a normalized embedding vector for a piece of text.
 * Returns Float32Array of length 512.
 */
export async function generateEmbedding(text) {
  const model = await loadEmbeddingModel();
  const output = await model(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

/**
 * Cosine similarity between two vectors.
 */
export function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Find the top-K most semantically similar records to a query embedding.
 */
export function findRelevantRecords(queryEmbedding, recordsWithEmbeddings, topK = 30) {
  const scored = recordsWithEmbeddings
    .filter(r => r.embedding && r.embedding.length > 0)
    .map(r => ({
      ...r,
      _score: cosineSimilarity(queryEmbedding, r.embedding),
    }))
    .sort((a, b) => b._score - a._score)
    .slice(0, topK);

  return scored;
}

/**
 * Database module exports
 */

export { getDatabase, closeDatabase, runQuery, runTransaction } from './client';
export { initializeSchema, cleanupExpiredCache, getDatabaseStats } from './schema';
export {
  // Content cache
  getContentByUrl,
  saveContent,
  saveContentBatch,
  hashContent,

  // Analysis results
  createAnalysis,
  updateAnalysisStatus,
  getAnalysis,

  // Deduplication
  checkUrlExists,
  addToDedupeCache,
  findSimilarBySimhash,

  // Rate limits
  updateRateLimit,
  getRateLimit,
} from './cache';

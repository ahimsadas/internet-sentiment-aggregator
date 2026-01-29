/**
 * Data processing module exports
 */

// Cleaning
export {
  cleanText,
  truncateText,
  extractSentences,
  countWords,
  isMeaningfulContent,
  processText,
} from './cleaner';

// Language detection
export {
  detectLanguage,
  detectLanguagesBatch,
  getLanguageDistribution,
  filterByLanguage,
  type LanguageDetectionResult,
} from './language-detect';

// Deduplication
export {
  canonicalizeUrl,
  hashUrl,
  extractDomain,
  deduplicateItems,
  getDomainDistribution,
  type DeduplicationResult,
} from './deduplicator';

// Normalization
export {
  normalizeItem,
  normalizeItems,
  validateItem,
  type NormalizationResult,
} from './normalizer';

/**
 * Data normalization pipeline
 *
 * Applies cleaning, language detection, and other processing to items
 */

import { NormalizedItem } from '../schemas/normalized-item';
import { processText, isMeaningfulContent } from './cleaner';
import { detectLanguage } from './language-detect';

export interface NormalizationResult {
  item: NormalizedItem;
  stats: {
    originalLength: number;
    cleanedLength: number;
    truncated: boolean;
    language: string | null;
    languageConfidence: number;
    wordCount: number;
    isMeaningful: boolean;
  };
  warnings: string[];
}

/**
 * Normalize a single item
 */
export function normalizeItem(item: NormalizedItem): NormalizationResult {
  const warnings: string[] = [];
  const originalLength = item.text.length;

  // Process text (clean and truncate)
  const { cleaned, truncated, wordCount, isMeaningful } = processText(item.text);

  if (truncated) {
    warnings.push(`Text truncated from ${originalLength} to ${cleaned.length} characters`);
  }

  if (!isMeaningful) {
    warnings.push('Content may not be meaningful (too short or low quality)');
  }

  // Detect language if not already set
  let language = item.language;
  let languageConfidence = 1.0;

  if (!language) {
    const detection = detectLanguage(cleaned);
    language = detection.code;
    languageConfidence = detection.confidence;

    if (!detection.isReliable) {
      warnings.push(`Language detection uncertain (confidence: ${(detection.confidence * 100).toFixed(0)}%)`);
    }
  }

  // Create normalized item
  const normalizedItem: NormalizedItem = {
    ...item,
    text: cleaned,
    language,
    meta: {
      ...item.meta,
      word_count: wordCount,
    },
  };

  return {
    item: normalizedItem,
    stats: {
      originalLength,
      cleanedLength: cleaned.length,
      truncated,
      language,
      languageConfidence,
      wordCount,
      isMeaningful,
    },
    warnings,
  };
}

/**
 * Normalize multiple items and filter out non-meaningful ones
 */
export function normalizeItems(
  items: NormalizedItem[],
  options: {
    filterNonMeaningful?: boolean;
    minWordCount?: number;
    allowedLanguages?: string[] | null;
  } = {}
): {
  items: NormalizedItem[];
  stats: {
    originalCount: number;
    normalizedCount: number;
    filteredCount: number;
    byReason: {
      nonMeaningful: number;
      tooShort: number;
      wrongLanguage: number;
    };
    languageDistribution: Record<string, number>;
    avgWordCount: number;
  };
  allWarnings: string[];
} {
  const {
    filterNonMeaningful = true,
    minWordCount = 10,
    allowedLanguages = null,
  } = options;

  const normalizedItems: NormalizedItem[] = [];
  const allWarnings: string[] = [];
  const languageCounts: Record<string, number> = {};
  let totalWordCount = 0;

  const byReason = {
    nonMeaningful: 0,
    tooShort: 0,
    wrongLanguage: 0,
  };

  for (const item of items) {
    const { item: normalized, stats, warnings } = normalizeItem(item);

    // Apply filters
    if (filterNonMeaningful && !stats.isMeaningful) {
      byReason.nonMeaningful++;
      continue;
    }

    if (stats.wordCount < minWordCount) {
      byReason.tooShort++;
      continue;
    }

    if (
      allowedLanguages &&
      allowedLanguages.length > 0 &&
      stats.language &&
      !allowedLanguages.includes(stats.language)
    ) {
      byReason.wrongLanguage++;
      continue;
    }

    // Track stats
    const lang = stats.language || 'unknown';
    languageCounts[lang] = (languageCounts[lang] || 0) + 1;
    totalWordCount += stats.wordCount;

    // Collect warnings
    allWarnings.push(...warnings.map(w => `[${item.url}]: ${w}`));

    normalizedItems.push(normalized);
  }

  return {
    items: normalizedItems,
    stats: {
      originalCount: items.length,
      normalizedCount: normalizedItems.length,
      filteredCount: items.length - normalizedItems.length,
      byReason,
      languageDistribution: languageCounts,
      avgWordCount: normalizedItems.length > 0 ? Math.round(totalWordCount / normalizedItems.length) : 0,
    },
    allWarnings: allWarnings.slice(0, 100), // Limit warnings
  };
}

/**
 * Validate that an item conforms to the expected schema
 */
export function validateItem(item: unknown): item is NormalizedItem {
  if (!item || typeof item !== 'object') return false;

  const obj = item as Record<string, unknown>;

  return (
    typeof obj.id === 'string' &&
    typeof obj.source_type === 'string' &&
    typeof obj.source_name === 'string' &&
    typeof obj.url === 'string' &&
    typeof obj.text === 'string' &&
    typeof obj.retrieved_at === 'string'
  );
}

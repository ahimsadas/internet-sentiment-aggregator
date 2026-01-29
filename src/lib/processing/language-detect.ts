/**
 * Language detection using franc
 */

import { franc, francAll } from 'franc';

// Minimum text length for reliable detection
const MIN_TEXT_LENGTH = 50;

// Confidence threshold for accepting detection
const CONFIDENCE_THRESHOLD = 0.8;

// Map of franc language codes to ISO 639-1 codes
const FRANC_TO_ISO: Record<string, string> = {
  'eng': 'en',
  'spa': 'es',
  'fra': 'fr',
  'deu': 'de',
  'por': 'pt',
  'ita': 'it',
  'nld': 'nl',
  'pol': 'pl',
  'rus': 'ru',
  'jpn': 'ja',
  'zho': 'zh',
  'kor': 'ko',
  'ara': 'ar',
  'hin': 'hi',
  'tur': 'tr',
  'vie': 'vi',
  'tha': 'th',
  'swe': 'sv',
  'dan': 'da',
  'nor': 'no',
  'fin': 'fi',
  'ces': 'cs',
  'ell': 'el',
  'heb': 'he',
  'ukr': 'uk',
  'ron': 'ro',
  'hun': 'hu',
  'ind': 'id',
  'msa': 'ms',
  'cat': 'ca',
  'bul': 'bg',
  'hrv': 'hr',
  'srp': 'sr',
  'slk': 'sk',
  'slv': 'sl',
  'lit': 'lt',
  'lav': 'lv',
  'est': 'et',
  'fas': 'fa',
  'ben': 'bn',
  'tam': 'ta',
  'tel': 'te',
};

// Common language names
const LANGUAGE_NAMES: Record<string, string> = {
  'en': 'English',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'pt': 'Portuguese',
  'it': 'Italian',
  'nl': 'Dutch',
  'pl': 'Polish',
  'ru': 'Russian',
  'ja': 'Japanese',
  'zh': 'Chinese',
  'ko': 'Korean',
  'ar': 'Arabic',
  'hi': 'Hindi',
  'tr': 'Turkish',
  'vi': 'Vietnamese',
  'th': 'Thai',
  'sv': 'Swedish',
  'da': 'Danish',
  'no': 'Norwegian',
  'fi': 'Finnish',
  'cs': 'Czech',
  'el': 'Greek',
  'he': 'Hebrew',
  'uk': 'Ukrainian',
  'ro': 'Romanian',
  'hu': 'Hungarian',
  'id': 'Indonesian',
  'ms': 'Malay',
  'ca': 'Catalan',
  'bg': 'Bulgarian',
  'hr': 'Croatian',
  'sr': 'Serbian',
  'sk': 'Slovak',
  'sl': 'Slovenian',
  'lt': 'Lithuanian',
  'lv': 'Latvian',
  'et': 'Estonian',
  'fa': 'Persian',
  'bn': 'Bengali',
  'ta': 'Tamil',
  'te': 'Telugu',
};

export interface LanguageDetectionResult {
  // ISO 639-1 language code (e.g., 'en')
  code: string | null;

  // Full language name (e.g., 'English')
  name: string | null;

  // Confidence score (0-1)
  confidence: number;

  // Whether detection is reliable
  isReliable: boolean;

  // Alternative detections
  alternatives: Array<{
    code: string;
    confidence: number;
  }>;
}

/**
 * Convert franc language code to ISO 639-1
 */
function francToIso(francCode: string): string | null {
  return FRANC_TO_ISO[francCode] || null;
}

/**
 * Detect language of text
 */
export function detectLanguage(text: string): LanguageDetectionResult {
  // Default result for insufficient text
  if (!text || text.length < MIN_TEXT_LENGTH) {
    return {
      code: null,
      name: null,
      confidence: 0,
      isReliable: false,
      alternatives: [],
    };
  }

  // Clean text for detection (remove URLs, numbers, etc.)
  const cleanedText = text
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/\d+/g, '')
    .replace(/[^\p{L}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleanedText.length < MIN_TEXT_LENGTH) {
    return {
      code: null,
      name: null,
      confidence: 0,
      isReliable: false,
      alternatives: [],
    };
  }

  // Get top detections
  const detections = francAll(cleanedText, { minLength: MIN_TEXT_LENGTH });

  if (!detections || detections.length === 0 || detections[0][0] === 'und') {
    return {
      code: null,
      name: null,
      confidence: 0,
      isReliable: false,
      alternatives: [],
    };
  }

  // Process top detection
  const [topFrancCode, topScore] = detections[0];
  const topIsoCode = francToIso(topFrancCode);

  // Process alternatives
  const alternatives = detections
    .slice(1, 4)
    .map(([francCode, score]) => ({
      code: francToIso(francCode) || francCode,
      confidence: score,
    }))
    .filter(alt => alt.code && alt.confidence > 0.1);

  // Calculate confidence relative to alternatives
  let confidence = topScore;
  if (alternatives.length > 0) {
    // If alternatives are close, reduce confidence
    const scoreDiff = topScore - alternatives[0].confidence;
    if (scoreDiff < 0.1) {
      confidence *= 0.7;
    }
  }

  const isReliable = confidence >= CONFIDENCE_THRESHOLD && !!topIsoCode;

  return {
    code: topIsoCode,
    name: topIsoCode ? LANGUAGE_NAMES[topIsoCode] || null : null,
    confidence,
    isReliable,
    alternatives,
  };
}

/**
 * Batch detect languages for multiple texts
 */
export function detectLanguagesBatch(
  texts: string[]
): Map<number, LanguageDetectionResult> {
  const results = new Map<number, LanguageDetectionResult>();

  for (let i = 0; i < texts.length; i++) {
    results.set(i, detectLanguage(texts[i]));
  }

  return results;
}

/**
 * Get language distribution from items
 */
export function getLanguageDistribution(
  languages: (string | null)[]
): Array<{ language: string; count: number; percent: number }> {
  const counts = new Map<string, number>();

  for (const lang of languages) {
    const key = lang || 'unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const total = languages.length;
  return Array.from(counts.entries())
    .map(([language, count]) => ({
      language,
      count,
      percent: Math.round((count / total) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Filter items by language
 */
export function filterByLanguage<T extends { language: string | null }>(
  items: T[],
  allowedLanguages: string[] | null
): T[] {
  if (!allowedLanguages || allowedLanguages.length === 0) {
    return items;
  }

  const allowedSet = new Set(allowedLanguages.map(l => l.toLowerCase()));

  return items.filter(item => {
    if (!item.language) return true; // Include items with unknown language
    return allowedSet.has(item.language.toLowerCase());
  });
}

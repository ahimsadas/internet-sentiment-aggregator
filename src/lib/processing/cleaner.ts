/**
 * Text cleaning utilities
 */

// Common boilerplate patterns to remove
const BOILERPLATE_PATTERNS = [
  // Cookie notices
  /we use cookies[^.]*\./gi,
  /this (website|site) uses cookies[^.]*\./gi,
  /by (continuing|using)[^.]*cookies[^.]*\./gi,

  // Newsletter signup
  /sign up for (our )?newsletter[^.]*\./gi,
  /subscribe to (our )?(newsletter|updates)[^.]*\./gi,
  /enter your email[^.]*\./gi,

  // Social media prompts
  /follow us on[^.]*\./gi,
  /share (this|on)[^.]*\./gi,
  /like us on facebook[^.]*\./gi,

  // Copyright notices
  /©\s*\d{4}[^.]*\./gi,
  /all rights reserved[^.]*\./gi,
  /copyright \d{4}[^.]*\./gi,

  // Navigation remnants
  /^\s*(home|about|contact|menu|search|login|signup)\s*$/gim,
  /^\s*skip to (main )?content\s*$/gim,

  // Read more / continue reading
  /\[read more\]/gi,
  /\[continue reading\]/gi,
  /click here to read more[^.]*\./gi,

  // Advertisement markers
  /\[advertisement\]/gi,
  /sponsored content/gi,
  /^\s*ad\s*$/gim,

  // Comment section headers
  /^\s*comments?\s*\(\d+\)\s*$/gim,
  /^\s*leave a (comment|reply)\s*$/gim,

  // Author bio patterns
  /about the author[:\s]*$/gim,
];

// Maximum text length (characters) - beyond this we truncate
const MAX_TEXT_LENGTH = 15000;

// Head/tail strategy: keep first N and last M characters
const HEAD_LENGTH = 10000;
const TAIL_LENGTH = 3000;

/**
 * Clean text by removing boilerplate and normalizing whitespace
 */
export function cleanText(text: string): string {
  if (!text) return '';

  let cleaned = text;

  // Remove HTML entities
  cleaned = cleaned.replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&[a-z]+;/gi, ' '); // Remove any other HTML entities

  // Remove HTML tags (if any remain)
  cleaned = cleaned.replace(/<[^>]*>/g, ' ');

  // Remove URLs (but keep them noted for reference if needed)
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '[URL]');

  // Remove email addresses
  cleaned = cleaned.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]');

  // Apply boilerplate removal patterns
  for (const pattern of BOILERPLATE_PATTERNS) {
    cleaned = cleaned.replace(pattern, ' ');
  }

  // Remove excessive whitespace
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Remove lines that are just navigation items
  const lines = cleaned.split('\n');
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim();
    // Skip very short lines that are likely navigation
    if (trimmed.length < 3) return false;
    // Skip lines that are just single words (likely menu items)
    if (!/\s/.test(trimmed) && trimmed.length < 20) return false;
    return true;
  });
  cleaned = filteredLines.join('\n');

  // Final whitespace normalization
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n'); // Max 2 newlines
  cleaned = cleaned.replace(/[ \t]+/g, ' '); // Single spaces
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Truncate text using head+tail strategy to preserve context
 */
export function truncateText(
  text: string,
  maxLength: number = MAX_TEXT_LENGTH,
  headLength: number = HEAD_LENGTH,
  tailLength: number = TAIL_LENGTH
): { text: string; truncated: boolean } {
  if (!text || text.length <= maxLength) {
    return { text, truncated: false };
  }

  // Ensure head + tail + separator fits in maxLength
  const separator = '\n\n[...content truncated...]\n\n';
  const effectiveHeadLength = Math.min(headLength, maxLength - tailLength - separator.length);

  if (effectiveHeadLength <= 0) {
    // Just return the head if we can't fit both
    return {
      text: text.slice(0, maxLength),
      truncated: true,
    };
  }

  const head = text.slice(0, effectiveHeadLength);
  const tail = text.slice(-tailLength);

  // Try to break at word boundaries
  const headEnd = head.lastIndexOf(' ');
  const tailStart = tail.indexOf(' ');

  const cleanHead = headEnd > effectiveHeadLength * 0.8
    ? head.slice(0, headEnd)
    : head;

  const cleanTail = tailStart > 0 && tailStart < tailLength * 0.2
    ? tail.slice(tailStart + 1)
    : tail;

  return {
    text: cleanHead + separator + cleanTail,
    truncated: true,
  };
}

/**
 * Extract clean sentences from text
 */
export function extractSentences(text: string): string[] {
  if (!text) return [];

  // Split on sentence boundaries
  const sentencePattern = /[.!?]+[\s\n]+|[\n]{2,}/;
  const sentences = text.split(sentencePattern);

  return sentences
    .map(s => s.trim())
    .filter(s => {
      // Filter out very short sentences
      if (s.length < 10) return false;
      // Filter out sentences that are likely boilerplate
      if (/^(share|click|subscribe|follow|sign up)/i.test(s)) return false;
      return true;
    });
}

/**
 * Count words in text
 */
export function countWords(text: string): number {
  if (!text) return 0;
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Check if text is likely meaningful content
 */
export function isMeaningfulContent(text: string, minLength: number = 50): boolean {
  if (!text || text.length < minLength) return false;

  const wordCount = countWords(text);
  if (wordCount < 10) return false;

  // Check if it's mostly repeated characters or garbage
  const uniqueChars = new Set(text.toLowerCase()).size;
  if (uniqueChars < 15) return false;

  // Check if average word length is reasonable (2-15 chars)
  const avgWordLength = text.length / wordCount;
  if (avgWordLength < 2 || avgWordLength > 15) return false;

  return true;
}

/**
 * Process text through the full cleaning pipeline
 */
export function processText(text: string): {
  cleaned: string;
  truncated: boolean;
  wordCount: number;
  isMeaningful: boolean;
} {
  const cleaned = cleanText(text);
  const { text: finalText, truncated } = truncateText(cleaned);
  const wordCount = countWords(finalText);
  const isMeaningful = isMeaningfulContent(finalText);

  return {
    cleaned: finalText,
    truncated,
    wordCount,
    isMeaningful,
  };
}

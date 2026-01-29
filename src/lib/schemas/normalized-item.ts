import { z } from 'zod';

/**
 * Source types for content items
 */
export const SourceTypeSchema = z.enum([
  'open_web',
  'community',
  'scholarly',
  'social',
  'other'
]);

export type SourceType = z.infer<typeof SourceTypeSchema>;

/**
 * Canonical schema for all collected content items.
 * This is the normalized format used throughout the pipeline.
 */
export const NormalizedItemSchema = z.object({
  // Unique identifier for this item
  id: z.string(),

  // Source classification
  source_type: SourceTypeSchema,

  // Name of the specific source (e.g., "nytimes.com", "bbc.com")
  source_name: z.string(),

  // Original URL of the content
  url: z.string().url(),

  // Title of the content (if available)
  title: z.string().nullable(),

  // Author or username (if available)
  author: z.string().nullable(),

  // Publication or post date (ISO 8601 format)
  published_at: z.string().datetime().nullable(),

  // When this item was retrieved (ISO 8601 format)
  retrieved_at: z.string().datetime(),

  // Detected language code (ISO 639-1, e.g., "en", "es", "zh")
  language: z.string().nullable(),

  // Geographic origin if detectable
  geo: z.string().nullable(),

  // Cleaned main text content
  text: z.string(),

  // Raw text before cleaning (optional, for debugging)
  raw_text: z.string().optional(),

  // Additional metadata specific to the source
  meta: z.object({
    // Engagement metrics
    upvotes: z.number().optional(),
    downvotes: z.number().optional(),
    comments_count: z.number().optional(),
    shares: z.number().optional(),
    views: z.number().optional(),

    // Reddit-specific
    subreddit: z.string().optional(),
    score: z.number().optional(),

    // HN-specific
    hn_id: z.number().optional(),
    hn_type: z.string().optional(),

    // Web-specific
    domain: z.string().optional(),
    word_count: z.number().optional(),

    // Quality signals
    is_original_content: z.boolean().optional(),
    has_media: z.boolean().optional(),

    // Bot/spam heuristics (computed later)
    spam_score: z.number().min(0).max(1).optional(),
    bot_likelihood: z.number().min(0).max(1).optional(),
    duplicate_count: z.number().optional(),
  }).passthrough().optional(),
});

export type NormalizedItem = z.infer<typeof NormalizedItemSchema>;

/**
 * Schema for a text chunk (segment of a NormalizedItem)
 * Used for more granular opinion mining
 */
export const TextChunkSchema = z.object({
  // Reference to parent item
  item_id: z.string(),

  // Chunk index within the item
  chunk_index: z.number().int().min(0),

  // The text content of this chunk
  text: z.string(),

  // Character offset in the original text
  start_offset: z.number().int().min(0),
  end_offset: z.number().int().min(0),

  // Type of chunk
  chunk_type: z.enum(['sentence', 'paragraph', 'section']),

  // Embedding vector (added during processing)
  embedding: z.array(z.number()).optional(),
});

export type TextChunk = z.infer<typeof TextChunkSchema>;

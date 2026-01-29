import { z } from 'zod';

/**
 * Timeframe options for analysis
 */
export const TimeframePresetSchema = z.enum([
  'last_24h',
  'last_week',
  'last_month',
  'last_3_months',
  'last_year',
  'custom'
]);

export type TimeframePreset = z.infer<typeof TimeframePresetSchema>;

/**
 * Custom timeframe with explicit dates
 */
export const CustomTimeframeSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
});

export type CustomTimeframe = z.infer<typeof CustomTimeframeSchema>;

/**
 * Geographic scope - accepts ISO 3166-1 alpha-2 country codes or null for global
 */
export const GeoScopeSchema = z.string().toLowerCase().nullable();

export type GeoScope = z.infer<typeof GeoScopeSchema>;

/**
 * Available data sources
 */
export const DataSourceSchema = z.enum([
  'openrouter_web_search',  // OpenRouter web search plugin
]);

export type DataSource = z.infer<typeof DataSourceSchema>;

/**
 * Input schema for the analysis API
 */
export const AnalysisInputSchema = z.object({
  // The main topic, event, or current affair to analyze
  topic: z.string()
    .min(2, 'Topic must be at least 2 characters')
    .max(500, 'Topic must be at most 500 characters'),

  // Timeframe for the analysis
  timeframe: z.union([
    TimeframePresetSchema,
    CustomTimeframeSchema,
  ]).default('last_week'),

  // Geographic scope
  geo_scope: GeoScopeSchema.default(null),

  // Language filters (ISO 639-1 codes)
  languages: z.array(z.string().length(2)).nullable().default(null),

  // Which data sources to use
  sources: z.array(DataSourceSchema).default(['openrouter_web_search']),

  // Maximum items to collect per source
  max_items_per_source: z.number().int().min(10).max(500).default(100),

  // Additional user-specified filters
  filters: z.object({
    // Exclude specific domains
    exclude_domains: z.array(z.string()).optional(),

    // Include only specific domains
    include_domains: z.array(z.string()).optional(),

    // Exclude certain keywords
    exclude_keywords: z.array(z.string()).optional(),

    // Minimum content length (characters)
    min_content_length: z.number().int().min(0).optional(),
  }).optional(),

  // Analysis options
  options: z.object({
    // Enable bot/spam detection heuristics
    enable_spam_detection: z.boolean().default(true),

    // Enable near-duplicate detection
    enable_deduplication: z.boolean().default(true),

    // Apply domain caps (prevent single domain from dominating)
    apply_domain_caps: z.boolean().default(true),

    // Domain cap percentage (max % of items from one domain)
    domain_cap_percent: z.number().min(5).max(50).default(10),

    // Minimum cluster size
    min_cluster_size: z.number().int().min(2).default(3),

    // Maximum number of clusters to return
    max_clusters: z.number().int().min(3).max(50).default(15),
  }).default({
    enable_spam_detection: true,
    enable_deduplication: true,
    apply_domain_caps: true,
    domain_cap_percent: 10,
    min_cluster_size: 3,
    max_clusters: 15,
  }),
});

export type AnalysisInput = z.infer<typeof AnalysisInputSchema>;

/**
 * Helper to convert timeframe preset to date range
 */
export function timeframeToDateRange(
  timeframe: TimeframePreset | CustomTimeframe
): { start: Date; end: Date } {
  const now = new Date();

  if (typeof timeframe === 'object' && 'start' in timeframe) {
    return {
      start: new Date(timeframe.start),
      end: new Date(timeframe.end),
    };
  }

  const end = now;
  let start: Date;

  switch (timeframe) {
    case 'last_24h':
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case 'last_week':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'last_month':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'last_3_months':
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case 'last_year':
      start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    case 'custom':
    default:
      // Default to last week if custom but no dates provided
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  return { start, end };
}

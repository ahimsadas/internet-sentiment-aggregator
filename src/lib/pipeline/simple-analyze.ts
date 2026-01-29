/**
 * Simplified Analysis Pipeline
 *
 * 3-step pipeline:
 * 1. LLM #1: Generate search phrases from user topic
 * 2. Web search using OpenRouter web search plugin
 * 3. LLM #2: Analyze content and return structured output
 */

import { v4 as uuidv4 } from 'uuid';
import { AnalysisInput, timeframeToDateRange } from '../schemas/input';
import {
  AnalysisOutput,
  StanceDistributionEntry,
} from '../schemas/output';
import { NormalizedItem } from '../schemas/normalized-item';
import { generateSearchPhrases } from '../llm/search-phrases';
import { analyzeContent } from '../llm/analyze-content';
import { searchMultipleQueries } from '../connectors/openrouter-search';
import { normalizeItems, deduplicateItems } from '../processing';

export interface PipelineProgress {
  stage: string;
  progress: number;
  message: string;
}

export interface PipelineOptions {
  onProgress?: (progress: PipelineProgress) => void;
  signal?: AbortSignal;
}

/**
 * Main analysis function - simplified pipeline
 */
export async function runAnalysis(
  input: AnalysisInput,
  options: PipelineOptions = {}
): Promise<AnalysisOutput> {
  const { onProgress, signal } = options;
  const analysisId = uuidv4();
  const startTime = new Date();

  const checkAborted = () => {
    if (signal?.aborted) {
      throw new Error('Analysis cancelled');
    }
  };

  const report = (stage: string, progress: number, message: string) => {
    onProgress?.({ stage, progress, message });
    console.log(`[${stage}] ${progress}% - ${message}`);
  };

  try {
    // ========================================
    // Stage 1: Generate Search Phrases (LLM #1)
    // ========================================
    checkAborted();
    report('search_phrases', 0, 'Generating search phrases...');

    const searchPhrases = await generateSearchPhrases(input.topic);

    report('search_phrases', 100, `Generated ${searchPhrases.length} search phrases`);

    // ========================================
    // Stage 2: Fetch from Web (OpenRouter Search)
    // ========================================
    checkAborted();
    report('fetch', 0, 'Searching the web...');

    const dateRange = timeframeToDateRange(input.timeframe);

    const fetchResult = await searchMultipleQueries(searchPhrases, {
      maxResults: Math.min(input.max_items_per_source || 50, 10), // OpenRouter limits per query
      searchContextSize: 'high',
      engine: 'exa',
      signal,
    });

    const rawItems = fetchResult.items;
    const rawCount = rawItems.length;

    report('fetch', 100, `Fetched ${rawCount} items from web`);

    // ========================================
    // Stage 3: Clean and Deduplicate
    // ========================================
    checkAborted();
    report('process', 0, 'Processing content...');

    const normalizeResult = normalizeItems(rawItems, {
      filterNonMeaningful: true,
      minWordCount: 10,
      allowedLanguages: input.languages,
    });

    report('process', 50, `Normalized ${normalizeResult.items.length} items`);

    // For sentiment analysis, we only want to remove truly duplicate content
    // (same article republished on multiple sites), NOT similar opinions.
    // Multiple sources expressing the same opinion adds weight to that stance.
    const dedupeResult = deduplicateItems(normalizeResult.items, {
      applyDomainCaps: input.options.apply_domain_caps,
      domainCapPercent: input.options.domain_cap_percent,
      simhashThreshold: 10, // Very lenient - only remove near-identical content
      checkCache: false, // Don't skip URLs from previous analyses - we want fresh results
    });

    const processedItems = dedupeResult.items;

    report('process', 100, `After dedup: ${processedItems.length} items`);

    // ========================================
    // Stage 4: Analyze Content (LLM #2)
    // ========================================
    checkAborted();
    report('analyze', 0, 'Analyzing content...');

    // Limit items sent to LLM to manage context
    const itemsForAnalysis = processedItems.slice(0, 50);

    const analysisResult = await analyzeContent(
      input.topic,
      itemsForAnalysis,
      { n_raw: rawCount, n_after_dedupe: processedItems.length }
    );

    report('analyze', 100, `Identified ${analysisResult.clusters.length} opinion clusters`);

    // ========================================
    // Stage 5: Assemble Output
    // ========================================
    report('assemble', 0, 'Assembling results...');

    // Build source breakdown
    const sourceBreakdown = buildSourceBreakdown(rawItems);

    // Build final output
    const output: AnalysisOutput = {
      analysis_id: analysisId,
      created_at: startTime.toISOString(),
      completed_at: new Date().toISOString(),
      status: 'completed',

      query: {
        topic: input.topic,
        timeframe: {
          start: dateRange.start.toISOString(),
          end: dateRange.end.toISOString(),
        },
        geo_scope: input.geo_scope,
        language_scope: input.languages,
        user_filters: input.filters || {},
      },

      sampling: {
        sources_used: ['openrouter_web_search'],
        n_raw: rawCount,
        n_after_dedupe: dedupeResult.items.length,
        n_analyzed: itemsForAnalysis.length,
        source_breakdown: sourceBreakdown,
        domain_caps_applied: dedupeResult.stats.domainCapApplied,
        weighting_policy: {
          description: 'Equal weight per item, with domain caps to prevent single-source dominance',
          params: {
            domain_cap_percent: input.options.domain_cap_percent,
          },
        },
      },

      stance_distribution: analysisResult.stanceDistribution,
      clusters: analysisResult.clusters,

      confidence: analysisResult.confidence,
    };

    report('assemble', 100, 'Analysis complete');

    return output;
  } catch (error) {
    console.error('Analysis pipeline error:', error);
    throw error;
  }
}

/**
 * Build source breakdown from items
 */
function buildSourceBreakdown(
  items: NormalizedItem[]
): Array<{ source_type: string; count: number; percent: number }> {
  const counts = new Map<string, number>();
  const total = items.length;

  for (const item of items) {
    const sourceType = item.source_name;
    counts.set(sourceType, (counts.get(sourceType) || 0) + 1);
  }

  return Array.from(counts.entries()).map(([source_type, count]) => ({
    source_type,
    count,
    percent: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
  }));
}

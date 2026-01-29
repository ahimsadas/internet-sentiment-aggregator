/**
 * LLM #2: Analyze retrieved content and return structured output
 */

import { jsonCompletion, LLMMessage } from './client';
import { NormalizedItem } from '../schemas/normalized-item';
import {
  Cluster,
  Evidence,
  StanceDistributionEntry,
  Stance,
  AspectTag,
} from '../schemas/output';

// What the LLM returns
interface LLMAnalysisResponse {
  clusters: Array<{
    label: string;
    stance: string;
    aspect_tags: string[];
    item_indices: number[];
    notes: string;
    evidence_excerpts: Array<{
      item_index: number;
      excerpt: string;
    }>;
  }>;
  stance_distribution: Array<{
    stance: string;
    percent: number;
  }>;
  overall_confidence: number;
  limitations: string[];
}

// What we pass to the analysis function
export interface WebContent {
  index: number;
  url: string;
  title: string | null;
  source_name: string;
  source_type: string;
  published_at: string | null;
  text: string;
}

// What we return after mapping
export interface AnalysisResult {
  clusters: Cluster[];
  stanceDistribution: StanceDistributionEntry[];
  confidence: {
    overall_score_0_1: number;
    limitations: string[];
    warnings: string[];
  };
}

const VALID_STANCES: Stance[] = ['support', 'oppose', 'mixed', 'unclear'];
const VALID_ASPECTS: AspectTag[] = [
  'cost', 'safety', 'ethics', 'legality', 'effectiveness',
  'environmental', 'social_impact', 'technical', 'political',
  'economic', 'health', 'privacy', 'security', 'innovation',
  'tradition', 'other'
];

const SYSTEM_PROMPT = `You are an expert sentiment analyst. Analyze web content about a given TOPIC and identify opinion clusters.

CRITICAL - STANCE DEFINITION:
- "support" = The content is IN FAVOR of or POSITIVE toward the TOPIC
- "oppose" = The content is AGAINST or CRITICAL of the TOPIC
- "mixed" = The content presents both positive and negative views
- "unclear" = Cannot determine the stance

IMPORTANT: Determine stance based on what the content ACTUALLY SAYS about the topic, not by theme.
For example, if the topic is "ICE enforcement":
- An article criticizing ICE = "oppose" (even if it mentions security)
- An article defending ICE = "support" (even if it mentions ethics)

TASK:
1. Read each item and determine its stance toward the TOPIC
2. Create ONE cluster per stance type (max 4 clusters: support, oppose, mixed, unclear)
3. Group ALL items with the same stance into that single cluster
4. Label each cluster by summarizing the main arguments for that stance
5. Select 2-4 evidence excerpts per cluster showing different sub-arguments

CRITICAL RULE - ONE CLUSTER PER STANCE:
- Do NOT create multiple "support" clusters - put all supporting items in ONE cluster
- Do NOT create multiple "oppose" clusters - put all opposing items in ONE cluster
- The cluster label should summarize the various arguments within that stance

RULES:
- ONLY use content provided - do not fabricate quotes
- Reference items by their index number [N]
- Keep labels concise (max 100 characters)
- Keep notes detailed (max 400 characters) to capture multiple sub-arguments
- Excerpts must be direct quotes (max 200 chars each)
- Include 2-4 excerpts per cluster to show different perspectives within that stance

VALID ASPECT TAGS: cost, safety, ethics, legality, effectiveness, environmental, social_impact, technical, political, economic, health, privacy, security, innovation, tradition, other

Return JSON:
{
  "clusters": [
    {
      "label": "Short descriptive label",
      "stance": "support|oppose|mixed|unclear",
      "aspect_tags": ["tag1", "tag2"],
      "item_indices": [0, 2, 5],
      "notes": "Brief explanation of this cluster's main argument",
      "evidence_excerpts": [
        {"item_index": 0, "excerpt": "Direct quote from content..."}
      ]
    }
  ],
  "stance_distribution": [
    {"stance": "support", "percent": 40},
    {"stance": "oppose", "percent": 35},
    {"stance": "mixed", "percent": 20},
    {"stance": "unclear", "percent": 5}
  ],
  "overall_confidence": 0.7,
  "limitations": ["List any data quality issues or caveats"]
}`;

/**
 * Truncate text for LLM context
 */
function truncateText(text: string, maxLength: number = 800): string {
  if (text.length <= maxLength) return text;

  // Try to break at sentence boundary
  const truncated = text.slice(0, maxLength);
  const lastSentence = truncated.lastIndexOf('. ');

  if (lastSentence > maxLength * 0.6) {
    return truncated.slice(0, lastSentence + 1);
  }

  // Fall back to word boundary
  const lastSpace = truncated.lastIndexOf(' ');
  return truncated.slice(0, lastSpace) + '...';
}

/**
 * Build user prompt with content items
 */
function buildUserPrompt(topic: string, items: WebContent[]): string {
  let prompt = `Analyze the following ${items.length} items about "${topic}":\n\n`;

  for (const item of items) {
    const date = item.published_at
      ? new Date(item.published_at).toISOString().split('T')[0]
      : 'unknown';

    prompt += `[${item.index}] Source: ${item.source_name} | Date: ${date}\n`;
    if (item.title) {
      prompt += `Title: ${item.title}\n`;
    }
    prompt += `"${truncateText(item.text)}"\n\n`;
  }

  prompt += `\nIdentify opinion clusters and return the structured JSON analysis.`;

  return prompt;
}

/**
 * Validate and clean stance value
 */
function validateStance(stance: string): Stance {
  const normalized = stance.toLowerCase() as Stance;
  return VALID_STANCES.includes(normalized) ? normalized : 'unclear';
}

/**
 * Validate and clean aspect tags
 */
function validateAspectTags(tags: string[]): AspectTag[] {
  return tags
    .map(t => t.toLowerCase() as AspectTag)
    .filter(t => VALID_ASPECTS.includes(t))
    .slice(0, 5); // Max 5 tags per cluster
}

/**
 * Validate and format datetime string
 */
function validateDatetime(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

/**
 * Analyze content and return structured output
 */
export async function analyzeContent(
  topic: string,
  items: NormalizedItem[],
  metadata: { n_raw: number; n_after_dedupe: number }
): Promise<AnalysisResult> {
  // Prepare content for LLM
  const webContent: WebContent[] = items.map((item, index) => ({
    index,
    url: item.url,
    title: item.title,
    source_name: item.source_name,
    source_type: item.source_type,
    published_at: item.published_at,
    text: item.text,
  }));

  const messages: LLMMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(topic, webContent) },
  ];

  try {
    console.log('[analyze] Sending content to LLM for analysis...');

    const result = await jsonCompletion<LLMAnalysisResponse>(messages, {
      temperature: 0.5,
      maxTokens: 4096,
    });

    console.log(`[analyze] Analysis complete. Tokens used: ${result.usage.totalTokens}`);

    // Save LLM response for debugging
    try {
      const fs = await import('fs');
      const path = await import('path');
      const debugDir = path.join(process.cwd(), 'data', 'debug');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      const debugFile = path.join(debugDir, `llm-analysis-${Date.now()}.json`);
      fs.writeFileSync(debugFile, JSON.stringify({
        topic,
        itemCount: items.length,
        request: {
          systemPrompt: SYSTEM_PROMPT.slice(0, 500) + '...',
          userPromptLength: messages[1].content.length,
        },
        response: result.data,
        usage: result.usage,
        timestamp: new Date().toISOString(),
      }, null, 2));
      console.log(`[analyze] Debug response saved to: ${debugFile}`);
    } catch (debugError) {
      console.warn('[analyze] Failed to save debug file:', debugError);
    }

    // Map LLM response to our output format
    return mapLLMResponseToOutput(result.data, items, metadata);
  } catch (error) {
    console.error('[analyze] LLM analysis failed:', error);
    return createFallbackAnalysis(items, metadata);
  }
}

/**
 * Map LLM response to our Cluster/Evidence format
 */
function mapLLMResponseToOutput(
  llmResponse: LLMAnalysisResponse,
  items: NormalizedItem[],
  _metadata: { n_raw: number; n_after_dedupe: number }
): AnalysisResult {
  const clusters: Cluster[] = [];
  const totalItems = items.length;

  for (let i = 0; i < llmResponse.clusters.length; i++) {
    const cluster = llmResponse.clusters[i];

    // Build evidence from excerpts
    const evidence: Evidence[] = [];
    for (const excerpt of cluster.evidence_excerpts.slice(0, 5)) {
      const itemIndex = excerpt.item_index;
      if (itemIndex >= 0 && itemIndex < items.length) {
        const item = items[itemIndex];
        evidence.push({
          url: item.url,
          title: item.title,
          source_name: item.source_name,
          source_type: item.source_type,
          published_at: validateDatetime(item.published_at),
          excerpt: (excerpt.excerpt || '').slice(0, 500),
        });
      }
    }

    // Skip clusters with no valid evidence
    if (evidence.length === 0) {
      // Add at least one evidence item from the cluster's items
      const firstItemIndex = cluster.item_indices[0];
      if (firstItemIndex !== undefined && firstItemIndex < items.length) {
        const item = items[firstItemIndex];
        evidence.push({
          url: item.url,
          title: item.title,
          source_name: item.source_name,
          source_type: item.source_type,
          published_at: validateDatetime(item.published_at),
          excerpt: (item.text || '').slice(0, 500),
        });
      }
    }

    // Still no evidence? Skip this cluster
    if (evidence.length === 0) continue;

    // Calculate share
    const clusterItemCount = cluster.item_indices.filter(
      idx => idx >= 0 && idx < items.length
    ).length;

    const sharePercent = totalItems > 0
      ? Math.round((clusterItemCount / totalItems) * 1000) / 10
      : 0;

    // Build breakdown
    const sourceTypeCounts = new Map<string, number>();
    const langCounts = new Map<string, number>();

    for (const idx of cluster.item_indices) {
      if (idx >= 0 && idx < items.length) {
        const item = items[idx];
        sourceTypeCounts.set(item.source_type, (sourceTypeCounts.get(item.source_type) || 0) + 1);
        if (item.language) {
          langCounts.set(item.language, (langCounts.get(item.language) || 0) + 1);
        }
      }
    }

    clusters.push({
      id: `cluster-${i + 1}`,
      label: cluster.label.slice(0, 150), // Allow longer labels
      stance: validateStance(cluster.stance),
      aspect_tags: validateAspectTags(cluster.aspect_tags),
      share: {
        count: clusterItemCount,
        percent: sharePercent,
      },
      breakdown: {
        by_source_type: Array.from(sourceTypeCounts.entries()).map(([source_type, count]) => ({
          source_type,
          count,
        })),
        by_language: Array.from(langCounts.entries()).map(([language, count]) => ({
          language,
          count,
        })),
      },
      evidence,
      notes: cluster.notes.slice(0, 500),
      confidence: {
        score_0_1: llmResponse.overall_confidence || 0.7,
        reasons: [],
      },
    });
  }

  // Map stance distribution
  const stanceDistribution: StanceDistributionEntry[] = VALID_STANCES.map(stance => {
    const entry = llmResponse.stance_distribution.find(
      s => s.stance.toLowerCase() === stance
    );
    const percent = entry?.percent || 0;
    return {
      stance,
      count: Math.round((percent / 100) * totalItems), // Compute count from percent
      percent,
    };
  });

  // Ensure percentages sum to ~100
  const totalPercent = stanceDistribution.reduce((sum, s) => sum + s.percent, 0);
  if (totalPercent > 0 && totalPercent !== 100) {
    const factor = 100 / totalPercent;
    for (const s of stanceDistribution) {
      s.percent = Math.round(s.percent * factor);
      s.count = Math.round((s.percent / 100) * totalItems);
    }
  }

  return {
    clusters,
    stanceDistribution,
    confidence: {
      overall_score_0_1: llmResponse.overall_confidence || 0.7,
      limitations: [
        ...llmResponse.limitations,
        'Analysis based on web search results only',
        'Results may not represent all perspectives on this topic',
      ],
      warnings: [],
    },
  };
}

/**
 * Fallback analysis if LLM fails
 */
function createFallbackAnalysis(
  items: NormalizedItem[],
  _metadata: { n_raw: number; n_after_dedupe: number }
): AnalysisResult {
  // Handle empty items case
  if (items.length === 0) {
    return {
      clusters: [],
      stanceDistribution: VALID_STANCES.map(stance => ({
        stance,
        count: 0,
        percent: stance === 'unclear' ? 100 : 0,
      })),
      confidence: {
        overall_score_0_1: 0.1,
        limitations: ['No content available for analysis'],
        warnings: ['No data to analyze'],
      },
    };
  }

  // Group by source as pseudo-clusters
  const bySource = new Map<string, NormalizedItem[]>();
  for (const item of items) {
    const source = item.source_name;
    if (!bySource.has(source)) {
      bySource.set(source, []);
    }
    bySource.get(source)!.push(item);
  }

  const clusters: Cluster[] = Array.from(bySource.entries())
    .slice(0, 5)
    .filter(([, sourceItems]) => sourceItems.length > 0)
    .map(([source, sourceItems], i) => ({
      id: `cluster-${i + 1}`,
      label: `Content from ${source}`,
      stance: 'unclear' as Stance,
      aspect_tags: ['other' as AspectTag],
      share: {
        count: sourceItems.length,
        percent: Math.round((sourceItems.length / items.length) * 100),
      },
      breakdown: {
        by_source_type: [{ source_type: sourceItems[0].source_type, count: sourceItems.length }],
        by_language: [],
      },
      evidence: sourceItems.slice(0, 2).map(item => ({
        url: item.url,
        title: item.title,
        source_name: item.source_name,
        source_type: item.source_type,
        published_at: validateDatetime(item.published_at),
        excerpt: (item.text || '').slice(0, 500),
      })),
      notes: 'Grouped by source due to analysis unavailability.',
      confidence: {
        score_0_1: 0.3,
        reasons: ['Fallback analysis used'],
      },
    }));

  return {
    clusters,
    stanceDistribution: VALID_STANCES.map(stance => ({
      stance,
      count: 0,
      percent: stance === 'unclear' ? 100 : 0,
    })),
    confidence: {
      overall_score_0_1: 0.3,
      limitations: ['LLM analysis failed, using fallback grouping by source'],
      warnings: ['Analysis quality is reduced'],
    },
  };
}

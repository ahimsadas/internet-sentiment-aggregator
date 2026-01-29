/**
 * OpenRouter Web Search
 *
 * Uses OpenRouter's web search plugin to search and retrieve web content
 * https://openrouter.ai/docs/guides/features/plugins/web-search
 */

import { v4 as uuidv4 } from 'uuid';
import { NormalizedItem } from '../schemas/normalized-item';

export interface WebSearchOptions {
  maxResults?: number;
  searchContextSize?: 'low' | 'medium' | 'high';
  engine?: 'native' | 'exa';
  signal?: AbortSignal;
}

export interface UrlCitation {
  type: 'url_citation';
  url_citation: {
    url: string;
    title: string;
    content: string;
    start_index: number;
    end_index: number;
  };
}

export interface WebSearchResult {
  content: string;
  citations: UrlCitation[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface SearchAndAnalyzeResult {
  items: NormalizedItem[];
  rawResponse: unknown;
  llmContent: string;
  citations: UrlCitation[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Perform a web search using OpenRouter's web search plugin
 */
export async function searchWeb(
  query: string,
  options: WebSearchOptions = {}
): Promise<WebSearchResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set');
  }

  const model = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
  const {
    maxResults = 10,
    searchContextSize = 'high',
    engine = 'exa',
    signal,
  } = options;

  const requestBody = {
    model: model,
    plugins: [
      {
        id: 'web',
        max_results: maxResults,
        engine: engine,
      },
    ],
    web_search_options: {
      search_context_size: searchContextSize,
    },
    messages: [
      {
        role: 'user',
        content: `Search the web for diverse opinions and perspectives on: "${query}"

Find articles, news, blog posts, and discussions that represent different viewpoints on this topic. Include both supporting and opposing perspectives.`,
      },
    ],
    temperature: 0.3,
    max_tokens: 2048,
  };

  console.log('\n┌─── OpenRouter Web Search Request ───────────────────────');
  console.log(`│ Model: ${model}`);
  console.log(`│ Query: "${query}"`);
  console.log(`│ Max Results: ${maxResults}`);
  console.log(`│ Search Context: ${searchContextSize}`);
  console.log(`│ Engine: ${engine}`);
  console.log('└─────────────────────────────────────────────────────────\n');

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
      'X-Title': 'Internet Sentiment Aggregator',
    },
    body: JSON.stringify(requestBody),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.log('\n┌─── OpenRouter Web Search Error ─────────────────────────');
    console.log(`│ Status: ${response.status}`);
    console.log(`│ Error: ${errorText}`);
    console.log('└─────────────────────────────────────────────────────────\n');
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Save full response to file for debugging
  const fs = await import('fs');
  const path = await import('path');
  const debugDir = path.join(process.cwd(), 'data', 'debug');
  if (!fs.existsSync(debugDir)) {
    fs.mkdirSync(debugDir, { recursive: true });
  }
  const debugFile = path.join(debugDir, `openrouter-search-${Date.now()}.json`);
  fs.writeFileSync(debugFile, JSON.stringify(data, null, 2));
  console.log(`│ Full response saved to: ${debugFile}`);

  // Log response summary
  console.log('\n┌─── OpenRouter Web Search Response ──────────────────────');
  console.log(`│ Model: ${data.model}`);

  const choice = data.choices?.[0];
  const message = choice?.message;
  const annotations = message?.annotations || [];

  console.log(`│ Citations found: ${annotations.length}`);
  console.log(`│ Tokens: ${data.usage?.prompt_tokens || 0} prompt + ${data.usage?.completion_tokens || 0} completion`);
  console.log('│');
  console.log('│ Citations:');

  for (let i = 0; i < annotations.length; i++) {
    const ann = annotations[i];
    if (ann.type === 'url_citation') {
      const citation = ann.url_citation;
      console.log(`│   [${i}] ${citation.title || 'No title'}`);
      console.log(`│       URL: ${citation.url}`);
      console.log(`│       Content: ${(citation.content || '').slice(0, 100)}...`);
    }
  }

  console.log('│');
  console.log('│ LLM Summary:');
  const contentPreview = (message?.content || '').slice(0, 500);
  contentPreview.split('\n').forEach((line: string) => {
    console.log(`│   ${line}`);
  });

  console.log('└─────────────────────────────────────────────────────────\n');

  return {
    content: message?.content || '',
    citations: annotations.filter((a: UrlCitation) => a.type === 'url_citation'),
    usage: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
    },
  };
}

/**
 * Clean citation content by removing navigation, ads, and noise
 */
function cleanCitationContent(rawContent: string): { cleaned: string; stats: { original: number; cleaned: number } } {
  if (!rawContent) return { cleaned: '', stats: { original: 0, cleaned: 0 } };

  const originalWords = rawContent.split(/\s+/).length;
  let content = rawContent;

  // Remove common noise patterns
  const noisePatterns = [
    // Navigation menu items (markdown links in lists)
    /^\s*\*\s*\[.{1,40}\]\s*$/gm,
    // Repeated navigation links
    /(?:\[.{1,30}\]\s*){4,}/g,
    // Social share buttons
    /\*?\s*(?:Twitter|Facebook|WhatsApp|Reddit|Email|LinkedIn|Instagram|Share|Threads|Snapchat)\s*\n?/gi,
    // Advertisement markers
    /Advertisement\s*\n?/gi,
    // "Read more", "Related", "Also read" sections
    /(?:Read\s*(?:More|Also|Next)|Related|Trending|Popular|You (?:May|Might) (?:Also )?Like|Top Stories|Latest News|Most Popular)[:\s]?[^\n]*\n?/gi,
    // Follow us / Subscribe prompts
    /(?:Follow\s*(?:Us|Me)|Subscribe|Newsletter|Get\s*App|Install\s*Now|Join\s*Us)[^\n]*\n?/gi,
    // Cookie/consent notices
    /(?:Cookie|Consent|GDPR|Privacy\s*Policy|Terms\s*of\s*Service)[^\n]*\n?/gi,
    // Empty markdown images/links
    /!\[\]\s*/g,
    /\[\]\s*/g,
    // Icon placeholders
    /\[?(?:arrow-down|arrow-up|arrow-left|arrow-right|search|bell|close|menu)[^\]]*\]?\s*/gi,
    // App download prompts
    /(?:Download|Get)\s*(?:App|the App)[^\n]*\n?/gi,
    // Footer section markers
    /(?:More\s*Links|Featured|Follow\s*Us\s*On)[^\n]*$/gim,
    // Lines that are just links to sections
    /^\s*\*\s*\[\n?\s*[A-Za-z]+\s*\]\s*$/gm,
    // Image captions that are just filenames
    /!\[(?:image|photo|picture|thumbnail|logo|icon)[^\]]*\]\([^)]*\)/gi,
  ];

  for (const pattern of noisePatterns) {
    content = content.replace(pattern, ' ');
  }

  // Remove lines that are very short and look like menu items
  const lines = content.split('\n');
  const meaningfulLines = lines.filter(line => {
    const trimmed = line.trim();
    // Keep headers
    if (trimmed.startsWith('#')) return true;
    // Skip very short lines (likely navigation)
    if (trimmed.length < 25 && !trimmed.match(/^[#*-]/)) return false;
    // Skip lines that are just markdown links
    if (/^\[.+\]\([^)]+\)$/.test(trimmed)) return false;
    // Skip lines that are just bullet points with single words
    if (/^\*\s*\w{1,15}\s*$/.test(trimmed)) return false;
    return true;
  });

  content = meaningfulLines.join('\n');

  // Clean up whitespace
  content = content
    .replace(/\n{3,}/g, '\n\n')  // Multiple newlines to double
    .replace(/\s{3,}/g, ' ')     // Multiple spaces to single
    .trim();

  // Truncate to reasonable length for LLM processing (max ~1500 words)
  const maxLength = 6000;
  if (content.length > maxLength) {
    // Try to cut at a sentence boundary
    const truncated = content.slice(0, maxLength);
    const lastSentence = truncated.lastIndexOf('. ');
    if (lastSentence > maxLength * 0.7) {
      content = truncated.slice(0, lastSentence + 1);
    } else {
      content = truncated + '...';
    }
  }

  const cleanedWords = content.split(/\s+/).length;

  return {
    cleaned: content,
    stats: { original: originalWords, cleaned: cleanedWords }
  };
}

/**
 * Convert citations to normalized items
 */
export function citationsToItems(citations: UrlCitation[]): NormalizedItem[] {
  const items: NormalizedItem[] = [];

  for (const citation of citations) {
    if (citation.type !== 'url_citation') continue;

    const { url, title, content: rawContent } = citation.url_citation;

    // Skip if no content
    if (!rawContent || rawContent.length < 50) continue;

    // Clean the content
    const { cleaned, stats } = cleanCitationContent(rawContent);

    // Skip if cleaned content is too short
    if (cleaned.length < 100) continue;

    // Extract domain
    let domain = 'unknown';
    try {
      const parsed = new URL(url);
      domain = parsed.hostname.replace(/^www\./, '');
    } catch {
      // Invalid URL
    }

    const noiseReduction = stats.original > 0
      ? Math.round((1 - stats.cleaned / stats.original) * 100)
      : 0;

    console.log(`│ [${domain}] Cleaned: ${stats.original} → ${stats.cleaned} words (${noiseReduction}% noise removed)`);

    const item: NormalizedItem = {
      id: uuidv4(),
      source_type: 'open_web',
      source_name: domain,
      url: url,
      title: title || null,
      author: null,
      published_at: null,
      retrieved_at: new Date().toISOString(),
      language: null,
      geo: null,
      text: cleaned, // Just the cleaned content, title is sent separately
      raw_text: rawContent,
      meta: {
        domain,
        word_count: stats.cleaned,
        original_word_count: stats.original,
        noise_reduction: noiseReduction,
      },
    };

    items.push(item);
  }

  return items;
}

/**
 * Search web for multiple queries and combine results
 */
export async function searchMultipleQueries(
  queries: string[],
  options: WebSearchOptions = {}
): Promise<SearchAndAnalyzeResult> {
  const allCitations: UrlCitation[] = [];
  const allContent: string[] = [];
  let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let rawResponse: unknown = null;

  // Search for each query
  for (const query of queries) {
    // Check if cancelled before starting each query
    if (options.signal?.aborted) {
      console.log('[search] Cancelled - stopping remaining queries');
      break;
    }

    try {
      console.log(`\n[search] Searching for: "${query}"`);
      const result = await searchWeb(query, options);

      allContent.push(result.content);
      allCitations.push(...result.citations);
      totalUsage.promptTokens += result.usage.promptTokens;
      totalUsage.completionTokens += result.usage.completionTokens;
      totalUsage.totalTokens += result.usage.totalTokens;

      if (!rawResponse) {
        rawResponse = result;
      }

      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      // If aborted, stop the loop instead of continuing
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[search] Cancelled - aborting');
        break;
      }
      console.error(`[search] Error searching for "${query}":`, error);
    }
  }

  // Deduplicate citations by URL
  const seenUrls = new Set<string>();
  const uniqueCitations = allCitations.filter(citation => {
    const url = citation.url_citation.url;
    if (seenUrls.has(url)) return false;
    seenUrls.add(url);
    return true;
  });

  console.log(`\n[search] Total unique citations: ${uniqueCitations.length}`);

  // Convert to normalized items
  const items = citationsToItems(uniqueCitations);

  return {
    items,
    rawResponse,
    llmContent: allContent.join('\n\n---\n\n'),
    citations: uniqueCitations,
    usage: totalUsage,
  };
}

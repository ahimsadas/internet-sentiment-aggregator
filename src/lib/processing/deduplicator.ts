/**
 * Deduplication utilities
 *
 * Combines URL-based and content-based (SimHash) deduplication
 */

import crypto from 'crypto';
import { NormalizedItem } from '../schemas/normalized-item';
import { computeSimHash, hammingDistance, findNearDuplicateGroups } from '../utils/simhash';
import { checkUrlExists, addToDedupeCache, findSimilarBySimhash } from '../db/cache';

// Default hamming distance threshold for near-duplicates
// Higher = more lenient (only removes very similar content)
// For sentiment analysis, we want to keep similar opinions from different sources
// as they add weight/validation to that stance. Only remove near-identical content.
// SimHash is 64-bit, so threshold of 5 means ~92% similar content
const DEFAULT_SIMHASH_THRESHOLD = 5;

// Maximum percentage of items from a single domain
// 25% allows more items from popular/authoritative sources while still ensuring diversity
const DEFAULT_DOMAIN_CAP_PERCENT = 25;

/**
 * Canonicalize URL for consistent hashing
 */
export function canonicalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Remove common tracking parameters
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'ref', 'source', 'mc_cid', 'mc_eid',
    ];

    for (const param of trackingParams) {
      parsed.searchParams.delete(param);
    }

    // Normalize
    let canonical = parsed.origin + parsed.pathname;

    // Sort remaining query params
    if (parsed.searchParams.toString()) {
      const sortedParams = new URLSearchParams(
        [...parsed.searchParams.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      );
      canonical += '?' + sortedParams.toString();
    }

    // Remove trailing slash (unless it's the root)
    if (canonical.endsWith('/') && canonical.length > parsed.origin.length + 1) {
      canonical = canonical.slice(0, -1);
    }

    return canonical.toLowerCase();
  } catch {
    // If URL parsing fails, just lowercase and return
    return url.toLowerCase().trim();
  }
}

/**
 * Hash a URL for quick lookup
 */
export function hashUrl(url: string): string {
  const canonical = canonicalizeUrl(url);
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

export interface DeduplicationResult {
  // Items after deduplication
  items: NormalizedItem[];

  // Statistics
  stats: {
    originalCount: number;
    urlDuplicatesRemoved: number;
    nearDuplicatesRemoved: number;
    finalCount: number;
    domainCapApplied: boolean;
    domainsCapped: string[];
  };

  // Duplicate groups for reference
  duplicateGroups: Array<{
    type: 'url' | 'content';
    urls: string[];
    kept: string;
  }>;
}

/**
 * Deduplicate items using URL and content-based methods
 */
export function deduplicateItems(
  items: NormalizedItem[],
  options: {
    checkCache?: boolean;
    simhashThreshold?: number;
    applyDomainCaps?: boolean;
    domainCapPercent?: number;
  } = {}
): DeduplicationResult {
  const {
    checkCache = true,
    simhashThreshold = DEFAULT_SIMHASH_THRESHOLD,
    applyDomainCaps = true,
    domainCapPercent = DEFAULT_DOMAIN_CAP_PERCENT,
  } = options;

  const originalCount = items.length;
  let urlDuplicatesRemoved = 0;
  let nearDuplicatesRemoved = 0;
  const duplicateGroups: DeduplicationResult['duplicateGroups'] = [];

  // Step 1: URL-based deduplication
  const urlHashes = new Map<string, NormalizedItem>();
  const urlDeduped: NormalizedItem[] = [];

  let cacheHits = 0;
  let inBatchDupes = 0;

  for (const item of items) {
    const urlHash = hashUrl(item.url);

    // Check if we've already seen this URL in the current batch
    if (urlHashes.has(urlHash)) {
      inBatchDupes++;
      urlDuplicatesRemoved++;
      const existing = urlHashes.get(urlHash)!;
      duplicateGroups.push({
        type: 'url',
        urls: [existing.url, item.url],
        kept: existing.url,
      });
      continue;
    }

    // Check database cache if enabled
    // NOTE: This skips URLs we've seen in PREVIOUS analyses - may not be desired
    // for sentiment analysis where we want fresh analysis each time
    if (checkCache && checkUrlExists(urlHash)) {
      cacheHits++;
      urlDuplicatesRemoved++;
      continue;
    }

    urlHashes.set(urlHash, item);
    urlDeduped.push(item);
  }

  if (cacheHits > 0 || inBatchDupes > 0) {
    console.log(`[dedup] URL check: ${inBatchDupes} in-batch duplicates, ${cacheHits} from previous cache`);
  }

  // Step 2: Content-based (SimHash) deduplication
  const simhashes = urlDeduped.map(item => ({
    item,
    hash: computeSimHash(item.text),
  }));

  // Find near-duplicate groups
  const texts = urlDeduped.map(item => item.text);
  const nearDupeGroups = findNearDuplicateGroups(texts, simhashThreshold);

  console.log(`[dedup] URL deduped: ${urlDeduped.length} items, SimHash threshold: ${simhashThreshold}, found ${nearDupeGroups.length} near-duplicate groups`);

  // Track which indices to remove
  const indicesToRemove = new Set<number>();

  for (const group of nearDupeGroups) {
    // Keep the first item (or the one with highest score if available)
    const items_in_group = group.map(i => urlDeduped[i]);

    // Sort by score (engagement) if available, otherwise keep first
    const sorted = items_in_group.sort((a, b) => {
      const scoreA = (a.meta?.score as number) || (a.meta?.upvotes as number) || 0;
      const scoreB = (b.meta?.score as number) || (b.meta?.upvotes as number) || 0;
      return scoreB - scoreA;
    });

    const kept = sorted[0];

    // Mark others for removal
    for (let i = 1; i < group.length; i++) {
      const idx = group[i];
      indicesToRemove.add(idx);
      nearDuplicatesRemoved++;
    }

    duplicateGroups.push({
      type: 'content',
      urls: items_in_group.map(item => item.url),
      kept: kept.url,
    });
  }

  // Remove near-duplicates
  const contentDeduped = urlDeduped.filter((_, i) => !indicesToRemove.has(i));

  // Step 3: Apply domain caps
  let finalItems = contentDeduped;
  let domainCapApplied = false;
  const domainsCapped: string[] = [];

  if (applyDomainCaps && contentDeduped.length > 0) {
    const maxItemsPerDomain = Math.ceil(contentDeduped.length * (domainCapPercent / 100));
    console.log(`[dedup] Domain cap: ${domainCapPercent}%, max ${maxItemsPerDomain} items per domain`);

    const domainCounts = new Map<string, number>();
    const cappedItems: NormalizedItem[] = [];

    for (const item of contentDeduped) {
      const domain = extractDomain(item.url);
      const currentCount = domainCounts.get(domain) || 0;

      if (currentCount >= maxItemsPerDomain) {
        if (!domainsCapped.includes(domain)) {
          domainsCapped.push(domain);
        }
        domainCapApplied = true;
        continue;
      }

      domainCounts.set(domain, currentCount + 1);
      cappedItems.push(item);
    }

    finalItems = cappedItems;
  }

  // Step 4: Add to cache for future lookups
  for (const item of finalItems) {
    const urlHash = hashUrl(item.url);
    const simhash = computeSimHash(item.text);
    addToDedupeCache(urlHash, simhash, item.url);
  }

  console.log(`[dedup] Final: ${originalCount} → ${finalItems.length} items (URL dupes: ${urlDuplicatesRemoved}, content dupes: ${nearDuplicatesRemoved}, domain capped: ${domainsCapped.length > 0 ? domainsCapped.join(', ') : 'none'})`);

  return {
    items: finalItems,
    stats: {
      originalCount,
      urlDuplicatesRemoved,
      nearDuplicatesRemoved,
      finalCount: finalItems.length,
      domainCapApplied,
      domainsCapped,
    },
    duplicateGroups,
  };
}

/**
 * Get domain distribution from items
 */
export function getDomainDistribution(
  items: NormalizedItem[]
): Array<{ domain: string; count: number; percent: number }> {
  const counts = new Map<string, number>();

  for (const item of items) {
    const domain = extractDomain(item.url);
    counts.set(domain, (counts.get(domain) || 0) + 1);
  }

  const total = items.length;
  return Array.from(counts.entries())
    .map(([domain, count]) => ({
      domain,
      count,
      percent: Math.round((count / total) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count);
}

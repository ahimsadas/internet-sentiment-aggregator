import { v4 as uuidv4 } from 'uuid';
import { runQuery } from './client';
import { NormalizedItem } from '../schemas/normalized-item';
import { AnalysisOutput } from '../schemas/output';
import crypto from 'crypto';

// Default TTL: 24 hours
const DEFAULT_TTL_SECONDS = parseInt(process.env.CACHE_TTL_SECONDS || '86400', 10);

/**
 * Calculate expiration time from TTL
 */
function getExpirationTime(ttlSeconds: number = DEFAULT_TTL_SECONDS): string {
  return new Date(Date.now() + ttlSeconds * 1000).toISOString();
}

/**
 * Generate a hash for content
 */
export function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

// ============================================
// Content Cache Operations
// ============================================

/**
 * Get cached content by URL
 */
export function getContentByUrl(url: string): NormalizedItem | null {
  return runQuery((db) => {
    const row = db.prepare(`
      SELECT * FROM content_cache
      WHERE url = ? AND expires_at > datetime('now')
    `).get(url) as {
      id: string;
      url: string;
      source_type: string;
      source_name: string;
      title: string | null;
      author: string | null;
      published_at: string | null;
      retrieved_at: string;
      language: string | null;
      geo: string | null;
      text: string;
      raw_text: string | null;
      meta: string | null;
    } | undefined;

    if (!row) return null;

    return {
      id: row.id,
      url: row.url,
      source_type: row.source_type as NormalizedItem['source_type'],
      source_name: row.source_name,
      title: row.title,
      author: row.author,
      published_at: row.published_at,
      retrieved_at: row.retrieved_at,
      language: row.language,
      geo: row.geo,
      text: row.text,
      raw_text: row.raw_text || undefined,
      meta: row.meta ? JSON.parse(row.meta) : undefined,
    };
  });
}

/**
 * Save content to cache
 */
export function saveContent(item: NormalizedItem, ttlSeconds?: number): void {
  runQuery((db) => {
    db.prepare(`
      INSERT OR REPLACE INTO content_cache
      (id, url, source_type, source_name, title, author, published_at,
       retrieved_at, language, geo, text, raw_text, meta, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      item.id,
      item.url,
      item.source_type,
      item.source_name,
      item.title,
      item.author,
      item.published_at,
      item.retrieved_at,
      item.language,
      item.geo,
      item.text,
      item.raw_text || null,
      item.meta ? JSON.stringify(item.meta) : null,
      getExpirationTime(ttlSeconds)
    );
  });
}

/**
 * Save multiple content items to cache (batch operation)
 */
export function saveContentBatch(items: NormalizedItem[], ttlSeconds?: number): void {
  runQuery((db) => {
    const insert = db.prepare(`
      INSERT OR REPLACE INTO content_cache
      (id, url, source_type, source_name, title, author, published_at,
       retrieved_at, language, geo, text, raw_text, meta, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items: NormalizedItem[]) => {
      const expiresAt = getExpirationTime(ttlSeconds);
      for (const item of items) {
        insert.run(
          item.id,
          item.url,
          item.source_type,
          item.source_name,
          item.title,
          item.author,
          item.published_at,
          item.retrieved_at,
          item.language,
          item.geo,
          item.text,
          item.raw_text || null,
          item.meta ? JSON.stringify(item.meta) : null,
          expiresAt
        );
      }
    });

    insertMany(items);
  });
}


// ============================================
// Analysis Results Cache Operations
// ============================================

/**
 * Create a new analysis record
 */
export function createAnalysis(
  topic: string,
  inputJson: string
): string {
  const id = uuidv4();
  runQuery((db) => {
    db.prepare(`
      INSERT INTO analysis_results
      (id, topic, input_json, status)
      VALUES (?, ?, ?, 'pending')
    `).run(id, topic, inputJson);
  });
  return id;
}

/**
 * Update analysis status
 */
export function updateAnalysisStatus(
  id: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  outputJson?: string,
  errorMessage?: string
): void {
  runQuery((db) => {
    const now = new Date().toISOString();

    if (status === 'processing') {
      db.prepare(`
        UPDATE analysis_results
        SET status = ?, started_at = ?
        WHERE id = ?
      `).run(status, now, id);
    } else if (status === 'completed') {
      db.prepare(`
        UPDATE analysis_results
        SET status = ?, output_json = ?, completed_at = ?, expires_at = ?
        WHERE id = ?
      `).run(status, outputJson, now, getExpirationTime(7 * 24 * 60 * 60), id); // 7 days TTL
    } else if (status === 'failed') {
      db.prepare(`
        UPDATE analysis_results
        SET status = ?, error_message = ?, completed_at = ?
        WHERE id = ?
      `).run(status, errorMessage, now, id);
    }
  });
}

/**
 * Get analysis by ID
 */
export function getAnalysis(id: string): {
  id: string;
  topic: string;
  input: unknown;
  output: AnalysisOutput | null;
  status: string;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
} | null {
  return runQuery((db) => {
    const row = db.prepare(`
      SELECT * FROM analysis_results WHERE id = ?
    `).get(id) as {
      id: string;
      topic: string;
      input_json: string;
      output_json: string | null;
      status: string;
      error_message: string | null;
      created_at: string;
      started_at: string | null;
      completed_at: string | null;
    } | undefined;

    if (!row) return null;

    return {
      id: row.id,
      topic: row.topic,
      input: JSON.parse(row.input_json),
      output: row.output_json ? JSON.parse(row.output_json) : null,
      status: row.status,
      error: row.error_message,
      createdAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    };
  });
}

// ============================================
// Deduplication Cache Operations
// ============================================

/**
 * Check if URL already exists in cache
 */
export function checkUrlExists(urlHash: string): boolean {
  return runQuery((db) => {
    const row = db.prepare(`
      SELECT 1 FROM dedupe_cache WHERE url_hash = ?
    `).get(urlHash);
    return !!row;
  });
}

/**
 * Add URL to deduplication cache
 */
export function addToDedupeCache(
  urlHash: string,
  contentSimhash: string,
  sourceUrl: string
): void {
  runQuery((db) => {
    db.prepare(`
      INSERT OR IGNORE INTO dedupe_cache
      (id, url_hash, content_simhash, source_url)
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), urlHash, contentSimhash, sourceUrl);
  });
}

/**
 * Find similar content by SimHash
 * Returns URLs with similar content (within hamming distance threshold)
 */
export function findSimilarBySimhash(
  simhash: string,
  maxDistance: number = 3
): string[] {
  return runQuery((db) => {
    // Get all simhashes (in a real system, we'd use a more efficient algorithm)
    const rows = db.prepare(`
      SELECT source_url, content_simhash FROM dedupe_cache
    `).all() as Array<{ source_url: string; content_simhash: string }>;

    const similar: string[] = [];
    for (const row of rows) {
      const distance = hammingDistance(simhash, row.content_simhash);
      if (distance <= maxDistance) {
        similar.push(row.source_url);
      }
    }
    return similar;
  });
}

/**
 * Calculate hamming distance between two hex strings
 */
function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Infinity;

  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    const xor = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    // Count set bits
    let bits = xor;
    while (bits) {
      distance += bits & 1;
      bits >>= 1;
    }
  }
  return distance;
}

// ============================================
// Rate Limit Operations
// ============================================

/**
 * Update rate limit status for a source
 */
export function updateRateLimit(
  source: string,
  remaining: number,
  limitTotal: number,
  resetAt: Date
): void {
  runQuery((db) => {
    db.prepare(`
      INSERT OR REPLACE INTO rate_limits
      (source, remaining, limit_total, reset_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(source, remaining, limitTotal, resetAt.toISOString());
  });
}

/**
 * Get rate limit status for a source
 */
export function getRateLimit(source: string): {
  remaining: number;
  limitTotal: number;
  resetAt: Date;
} | null {
  return runQuery((db) => {
    const row = db.prepare(`
      SELECT remaining, limit_total, reset_at FROM rate_limits
      WHERE source = ?
    `).get(source) as {
      remaining: number;
      limit_total: number;
      reset_at: string;
    } | undefined;

    if (!row) return null;

    return {
      remaining: row.remaining,
      limitTotal: row.limit_total,
      resetAt: new Date(row.reset_at),
    };
  });
}

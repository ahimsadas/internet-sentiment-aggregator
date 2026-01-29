import Database from 'better-sqlite3';

/**
 * Initialize the database schema
 */
export function initializeSchema(db: Database.Database): void {
  // Content cache table - stores fetched content
  db.exec(`
    CREATE TABLE IF NOT EXISTS content_cache (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL UNIQUE,
      source_type TEXT NOT NULL,
      source_name TEXT NOT NULL,
      title TEXT,
      author TEXT,
      published_at TEXT,
      retrieved_at TEXT NOT NULL,
      language TEXT,
      geo TEXT,
      text TEXT NOT NULL,
      raw_text TEXT,
      meta TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      UNIQUE(url)
    )
  `);

  // Index for URL lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_content_cache_url
    ON content_cache(url)
  `);

  // Index for expiration cleanup
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_content_cache_expires
    ON content_cache(expires_at)
  `);

  // Index for source-based queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_content_cache_source
    ON content_cache(source_type, source_name)
  `);

  // Embedding cache table - stores computed embeddings
  db.exec(`
    CREATE TABLE IF NOT EXISTS embedding_cache (
      id TEXT PRIMARY KEY,
      content_hash TEXT NOT NULL UNIQUE,
      model TEXT NOT NULL,
      embedding BLOB NOT NULL,
      dimensions INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Index for content hash lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_embedding_cache_hash
    ON embedding_cache(content_hash, model)
  `);

  // Analysis results table - stores completed analyses
  db.exec(`
    CREATE TABLE IF NOT EXISTS analysis_results (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      input_json TEXT NOT NULL,
      output_json TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      started_at TEXT,
      completed_at TEXT,
      expires_at TEXT
    )
  `);

  // Index for status queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_analysis_status
    ON analysis_results(status)
  `);

  // Deduplication cache - stores URL and content hashes
  db.exec(`
    CREATE TABLE IF NOT EXISTS dedupe_cache (
      id TEXT PRIMARY KEY,
      url_hash TEXT NOT NULL,
      content_simhash TEXT NOT NULL,
      source_url TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(url_hash)
    )
  `);

  // Index for simhash lookups (near-duplicate detection)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_dedupe_simhash
    ON dedupe_cache(content_simhash)
  `);

  // Rate limit tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      source TEXT PRIMARY KEY,
      remaining INTEGER NOT NULL,
      limit_total INTEGER NOT NULL,
      reset_at TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

/**
 * Clean up expired cache entries
 */
export function cleanupExpiredCache(db: Database.Database): number {
  const now = new Date().toISOString();

  const contentResult = db.prepare(`
    DELETE FROM content_cache WHERE expires_at < ?
  `).run(now);

  const analysisResult = db.prepare(`
    DELETE FROM analysis_results WHERE expires_at < ? AND status = 'completed'
  `).run(now);

  return Number(contentResult.changes) + Number(analysisResult.changes);
}

/**
 * Get database statistics
 */
export function getDatabaseStats(db: Database.Database): {
  contentCacheCount: number;
  analysisCount: number;
  dedupeCacheCount: number;
} {
  const contentCount = db.prepare('SELECT COUNT(*) as count FROM content_cache').get() as { count: number };
  const analysisCount = db.prepare('SELECT COUNT(*) as count FROM analysis_results').get() as { count: number };
  const dedupeCount = db.prepare('SELECT COUNT(*) as count FROM dedupe_cache').get() as { count: number };

  return {
    contentCacheCount: contentCount.count,
    analysisCount: analysisCount.count,
    dedupeCacheCount: dedupeCount.count,
  };
}

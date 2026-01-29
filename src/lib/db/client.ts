import Database from 'better-sqlite3';
import path from 'path';
import { initializeSchema } from './schema';

// Database file location
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'cache.db');

// Singleton database instance
let db: Database.Database | null = null;

/**
 * Get or create the database connection
 */
export function getDatabase(): Database.Database {
  if (db) {
    return db;
  }

  // Ensure the data directory exists
  const fs = require('fs');
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Create database connection
  db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Initialize schema
  initializeSchema(db);

  return db;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Run a database query with error handling
 */
export function runQuery<T>(
  queryFn: (db: Database.Database) => T
): T {
  const database = getDatabase();
  try {
    return queryFn(database);
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

/**
 * Run a database transaction
 */
export function runTransaction<T>(
  transactionFn: (db: Database.Database) => T
): T {
  const database = getDatabase();
  const transaction = database.transaction(transactionFn);
  return transaction(database);
}

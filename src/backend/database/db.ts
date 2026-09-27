import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { runMigrations } from './migrations';
import { seedAuthFixtures } from './seed';

let dbInstance: Database.Database | null = null;

export interface InitDbOptions {
  customPath?: string;
  seed?: boolean;
}

/**
 * Initializes and configures the SQLite database.
 * Sets foreign keys, WAL mode, runs schema migrations, and seeds test fixtures.
 */
export function initDatabase(options?: InitDbOptions | string): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const customPath = typeof options === 'string' ? options : options?.customPath;
  const shouldSeed = typeof options === 'object' ? options?.seed ?? true : true;

  const resolvedPath = customPath || config.dbPath;
  const dbDir = path.dirname(resolvedPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(resolvedPath);

  // Configure SQLite PRAGMAs for ACID correctness, safety, and performance
  db.pragma('foreign_keys = ON;');
  db.pragma('journal_mode = WAL;');

  // Execute database migrations
  runMigrations(db);

  // Seed deterministic authentication fixtures if enabled
  if (shouldSeed) {
    seedAuthFixtures(db);
  }

  dbInstance = db;
  return dbInstance;
}

/**
 * Returns the active database instance.
 */
export function getDatabase(): Database.Database {
  if (!dbInstance) {
    return initDatabase();
  }
  return dbInstance;
}

/**
 * Alias for getDatabase.
 */
export function getDb(): Database.Database {
  return getDatabase();
}

/**
 * Checks if the database is connected and responding.
 */
export function isDatabaseConnected(): boolean {
  try {
    const db = getDatabase();
    const result = db.prepare('SELECT 1 as alive').get() as { alive: number } | undefined;
    return result?.alive === 1;
  } catch {
    return false;
  }
}

/**
 * Gracefully closes the database connection.
 */
export function closeDatabase(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } finally {
      dbInstance = null;
    }
  }
}

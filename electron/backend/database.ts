import Database, { Database as DatabaseType } from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

let db: DatabaseType | null = null;

export interface DatabaseConfig {
  filename?: string;
  verbose?: boolean;
}

export function initializeDatabase(config: DatabaseConfig = {}): DatabaseType {
  if (db) return db;

  const { filename = 'textmyagent.db', verbose = !app.isPackaged } = config;

  // Database location
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, filename);

  // Ensure directory exists
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  console.log(`[Database] Initializing at ${dbPath}`);

  // Create database connection
  db = new Database(dbPath, {
    verbose: verbose ? (sql) => console.log(`[SQL] ${sql}`) : undefined,
  });

  // Performance optimizations
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -64000');
  db.pragma('foreign_keys = ON');
  db.pragma('temp_store = MEMORY');

  // Run migrations
  runMigrations(db);

  return db;
}

export function getDatabase(): DatabaseType {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    console.log('[Database] Closing connection');
    db.close();
    db = null;
  }
}

// Migration system
interface Migration {
  version: number;
  name: string;
  up: (db: DatabaseType) => void;
}

const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: (db) => {
      db.exec(`
        -- Users/Contacts table
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          handle TEXT UNIQUE NOT NULL,
          display_name TEXT,
          avatar_url TEXT,
          is_blocked INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );

        -- Conversations table
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id),
          last_message_at TEXT,
          is_muted INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        );

        -- Messages table
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL REFERENCES conversations(id),
          role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
          content TEXT NOT NULL,
          metadata TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );

        -- Context/Memory table
        CREATE TABLE IF NOT EXISTS context (
          id TEXT PRIMARY KEY,
          user_id TEXT REFERENCES users(id),
          type TEXT NOT NULL,
          content TEXT NOT NULL,
          expires_at TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );

        -- Settings table (key-value store)
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT DEFAULT (datetime('now'))
        );

        -- Reminders table
        CREATE TABLE IF NOT EXISTS reminders (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id),
          message TEXT NOT NULL,
          scheduled_at TEXT NOT NULL,
          delivered INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        );

        -- API Usage table
        CREATE TABLE IF NOT EXISTS api_usage (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          input_tokens INTEGER DEFAULT 0,
          output_tokens INTEGER DEFAULT 0,
          total_tokens INTEGER DEFAULT 0,
          request_count INTEGER DEFAULT 0,
          model TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          UNIQUE(date, model)
        );

        -- Indexes
        CREATE INDEX IF NOT EXISTS idx_messages_conversation
          ON messages(conversation_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_conversations_user
          ON conversations(user_id);
        CREATE INDEX IF NOT EXISTS idx_context_user
          ON context(user_id, type);
        CREATE INDEX IF NOT EXISTS idx_reminders_scheduled
          ON reminders(scheduled_at, delivered);
        CREATE INDEX IF NOT EXISTS idx_api_usage_date
          ON api_usage(date);
      `);
    },
  },
  {
    version: 2,
    name: 'add_triggers_table',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS triggers (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id),
          name TEXT NOT NULL,
          schedule TEXT NOT NULL,
          action TEXT NOT NULL,
          is_active INTEGER DEFAULT 1,
          last_run_at TEXT,
          next_run_at TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_triggers_next_run
          ON triggers(next_run_at, is_active);
      `);
    },
  },
  {
    version: 3,
    name: 'add_chat_guid_to_conversations',
    up: (db) => {
      // Add chat_guid column if it doesn't exist
      try {
        db.exec(`ALTER TABLE conversations ADD COLUMN chat_guid TEXT`);
      } catch (e) {
        // Column might already exist
      }
      
      // Create index for chat_guid lookups
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_conversations_chat_guid
          ON conversations(chat_guid);
      `);
    },
  },
];

function runMigrations(db: DatabaseType): void {
  // Create migrations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Get current version
  const currentVersion = db
    .prepare('SELECT MAX(version) as version FROM _migrations')
    .get() as { version: number | null };

  const appliedVersion = currentVersion?.version ?? 0;

  // Apply pending migrations
  const pendingMigrations = migrations.filter((m) => m.version > appliedVersion);

  if (pendingMigrations.length === 0) {
    console.log('[Database] No pending migrations');
    return;
  }

  console.log(`[Database] Applying ${pendingMigrations.length} migration(s)`);

  const insertMigration = db.prepare(
    'INSERT INTO _migrations (version, name) VALUES (?, ?)'
  );

  for (const migration of pendingMigrations) {
    console.log(`[Database] Running migration ${migration.version}: ${migration.name}`);

    db.transaction(() => {
      migration.up(db);
      insertMigration.run(migration.version, migration.name);
    })();
  }

  console.log('[Database] Migrations complete');
}

// Helper functions
export function getSetting(key: string): string | null {
  const db = getDatabase();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  const db = getDatabase();
  db.prepare(
    `
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')
  `
  ).run(key, value, value);
}

export function deleteSetting(key: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM settings WHERE key = ?').run(key);
}

// Record API usage for token tracking
export function recordApiUsage(inputTokens: number, outputTokens: number, model = 'claude-3-5-haiku-latest'): void {
  const db = getDatabase();
  const today = new Date().toISOString().split('T')[0];
  
  db.prepare(`
    INSERT INTO api_usage (date, input_tokens, output_tokens, total_tokens, request_count, model)
    VALUES (?, ?, ?, ?, 1, ?)
    ON CONFLICT(date, model) DO UPDATE SET
      input_tokens = input_tokens + ?,
      output_tokens = output_tokens + ?,
      total_tokens = total_tokens + ?,
      request_count = request_count + 1
  `).run(today, inputTokens, outputTokens, inputTokens + outputTokens, model, inputTokens, outputTokens, inputTokens + outputTokens);
}

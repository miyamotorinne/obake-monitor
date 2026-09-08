import nextEnv from '@next/env';
import { createClient } from '@libsql/client';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

if (process.env.VERCEL && !process.env.TURSO_DATABASE_URL) {
  throw new Error('TURSO_DATABASE_URL must be configured for a Vercel deployment. Migration stopped to protect existing data.');
}

if (!process.env.ADMIN_PASSWORD) {
  console.warn('ADMIN_PASSWORD is not configured. The site will build, but admin login will remain disabled.');
}

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:obake.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const baseSchema = [
  `CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    observer_id INTEGER,
    FOREIGN KEY (observer_id) REFERENCES observers(id)
  )`,
  `CREATE TABLE IF NOT EXISTS quests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    author_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    observer_id INTEGER,
    FOREIGN KEY (observer_id) REFERENCES observers(id)
  )`,
  `CREATE TABLE IF NOT EXISTS observers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    points INTEGER DEFAULT 0,
    favorite_title TEXT,
    gacha_tickets INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS observer_titles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    observer_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    is_rare BOOLEAN DEFAULT 0,
    acquired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (observer_id) REFERENCES observers(id)
  )`,
  `CREATE TABLE IF NOT EXISTS gacha_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    observer_name TEXT NOT NULL,
    title_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS observer_recovery_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    observer_id INTEGER NOT NULL,
    code_hash TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (observer_id) REFERENCES observers(id)
  )`,
  `CREATE TABLE IF NOT EXISTS admin_login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_hash TEXT NOT NULL,
    attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
];

async function hasColumn(table, column) {
  const result = await db.execute(`PRAGMA table_info(${table})`);
  return result.rows.some((row) => row.name === column);
}

try {
  await db.migrate(baseSchema);

  const additions = [];
  if (!(await hasColumn('quests', 'observer_id'))) {
    additions.push('ALTER TABLE quests ADD COLUMN observer_id INTEGER REFERENCES observers(id)');
  }
  if (!(await hasColumn('reactions', 'observer_id'))) {
    additions.push('ALTER TABLE reactions ADD COLUMN observer_id INTEGER REFERENCES observers(id)');
  }

  additions.push(
    'CREATE UNIQUE INDEX IF NOT EXISTS observer_titles_observer_name_unique ON observer_titles(observer_id, name)',
    'CREATE INDEX IF NOT EXISTS observer_recovery_codes_lookup ON observer_recovery_codes(code_hash, expires_at, used_at)',
    'CREATE INDEX IF NOT EXISTS admin_login_attempts_actor_time ON admin_login_attempts(actor_hash, attempted_at)',
    'CREATE INDEX IF NOT EXISTS reactions_observer_time ON reactions(observer_id, created_at)',
  );

  await db.migrate(additions);
  console.log('Database migration complete.');
} finally {
  db.close();
}

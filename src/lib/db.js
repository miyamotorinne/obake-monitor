import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:obake.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Initialize database schema
// Note: In a real production Turso environment, this is usually run via Turso CLI,
// but we run it here so it creates the tables if they don't exist in local or cloud.
db.executeMultiple(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS quests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    author_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    observer_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS observers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    points INTEGER DEFAULT 0,
    favorite_title TEXT,
    gacha_tickets INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS observer_titles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    observer_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    is_rare BOOLEAN DEFAULT 0,
    acquired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (observer_id) REFERENCES observers(id)
  );

  CREATE TABLE IF NOT EXISTS gacha_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    observer_name TEXT NOT NULL,
    title_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`).catch(err => {
  console.error("Failed to initialize database tables:", err);
});

export default db;

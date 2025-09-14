import Fastify from "fastify";
import fs from "node:fs";
import Database from "better-sqlite3";

const {
  DB_PATH = "/data/app.db",
  PORT = "7000",
  HOST = "0.0.0.0",
  API_TOKEN = "secure-random-token-change-me",
} = process.env;

const app = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true
      }
    }
  }
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  app.log.info(`Received ${signal}, shutting down gracefully...`);
  try {
    if (db) {
      db.close();
      app.log.info('Database connection closed');
    }
    await app.close();
    app.log.info('Server closed');
    process.exit(0);
  } catch (err) {
    app.log.error('Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Add authentication middleware
app.addHook('preValidation', async (request, reply) => {
  // Skip authentication for health check
  if (request.url === '/healthz') {
    return;
  }

  const authHeader = request.headers.authorization;
  const expectedToken = `Bearer ${API_TOKEN}`;

  if (!authHeader || authHeader !== expectedToken) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
});

// Initialize database tables for user management
const initializeTables = () => {
  try {
    // Users table
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email_verified INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        two_factor_enabled INTEGER DEFAULT 0,
        two_factor_secret TEXT,
        backup_codes TEXT,
        avatar BLOB,
        avatar_mimetype TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add avatar columns to existing users table if they don't exist
    try {
      db.exec(`ALTER TABLE users ADD COLUMN avatar BLOB`);
    } catch (e) {
      // Column already exists, which is fine
    }
    
    try {
      db.exec(`ALTER TABLE users ADD COLUMN avatar_mimetype TEXT`);
    } catch (e) {
      // Column already exists, which is fine
    }

    // OAuth providers table
    db.exec(`
      CREATE TABLE IF NOT EXISTS oauth_providers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        provider_user_id TEXT NOT NULL,
        username TEXT,
        email TEXT,
        avatar TEXT,
        linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        UNIQUE(provider, provider_user_id)
      )
    `);

    // OAuth tokens table
    db.exec(`
      CREATE TABLE IF NOT EXISTS oauth_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        access_token TEXT,
        refresh_token TEXT,
        expires_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        UNIQUE(user_id, provider)
      )
    `);

    // Chat tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        name TEXT,
        type TEXT NOT NULL DEFAULT 'private',
        created_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS chat_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active INTEGER DEFAULT 1,
        FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        UNIQUE(chat_id, user_id)
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        message TEXT NOT NULL,
        message_type TEXT DEFAULT 'text',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME,
        FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better chat performance
    try {
      db.exec(`CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id ON chat_participants(user_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_chat_participants_chat_id ON chat_participants(chat_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)`);
    } catch (indexError) {
      app.log.warn('Some indexes already exist or failed to create:', indexError.message);
    }

    app.log.info('Database tables initialized successfully');
  } catch (error) {
    app.log.error('Failed to initialize database tables:', error);
    throw error;
  }
};

// --- SQLite ---
let db;
try {
  app.log.info(`Initializing SQLite database at: ${DB_PATH}`);

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");

  // Initialize tables
  initializeTables();

  const result = db.prepare("SELECT sqlite_version() as version").get();
  app.log.info(`SQLite database initialized successfully. SQLite version: ${result.version}`);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  app.log.info(`Found ${tables.length} existing tables: ${tables.map(t => t.name).join(', ') || 'none'}`);

} catch (error) {
  app.log.error('Failed to initialize SQLite database:', error.message);
  app.log.error('DB_PATH:', DB_PATH);
  app.log.error('Error details:', error);
  process.exit(1);
}

const deny = (sql) => {
  const s = sql.toLowerCase();
  const banned = ["attach ", "vacuum", "pragma ", "begin ", "commit", "rollback"];
  return !banned.some((k) => s.includes(k));
};

app.get("/healthz", async () => {
  try {
    // Test database connectivity
    db.prepare("SELECT 1").get();
    return { ok: true, status: "healthy", timestamp: new Date().toISOString() };
  } catch (error) {
    throw new Error(`Database connectivity check failed: ${error.message}`);
  }
});


app.post("/query", async (req, reply) => {
  const { sql, params = [] } = req.body ?? {};
  if (!sql || typeof sql !== "string") return reply.code(400).send({ error: "missing sql" });
  if (!deny(sql)) return reply.code(400).send({ error: "statement not allowed" });

  try {
    const isWrite = /^(insert|update|delete|replace|create|drop|alter)/i.test(sql.trim());
    const stmt = db.prepare(sql);
    if (isWrite) {
      const info = Array.isArray(params) ? stmt.run(...params) : stmt.run(params);
      return reply.send({ changes: info.changes ?? 0, lastInsertRowid: info.lastInsertRowid ?? null });
    } else {
      const rows = Array.isArray(params) ? stmt.all(...params) : stmt.all(params);
      return reply.send(rows);
    }
  } catch (e) {
    req.log.error(e);
    return reply.code(400).send({ error: `sqlite error: ${e.message}` });
  }
});

app.listen({ host: HOST, port: Number(PORT) })
  .then(() => app.log.info(`listening on http://${HOST}:${PORT}`))
  .catch((err) => { app.log.error(err); process.exit(1); });

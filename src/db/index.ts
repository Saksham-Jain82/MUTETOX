import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * Database bootstrap that stays import-safe in environments without a
 * database (Vercel build workers, CI prerendering, etc.). The pool only
 * opens a socket on first query, and routes that need the DB — currently
 * just /api/health — already degrade gracefully to { ok: false } when the
 * connection fails.
 */
const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://127.0.0.1:5432/_no_database_configured";

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);

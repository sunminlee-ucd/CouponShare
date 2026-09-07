import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type DatabaseClient = ReturnType<typeof postgres>;

const globalForDatabase = globalThis as typeof globalThis & {
  couponSharePostgres?: DatabaseClient;
};

const DATABASE_RECONNECT_ATTEMPTS = 2;
const DATABASE_FIRST_HEALTH_TIMEOUT_MS = 1_800;
const DATABASE_RECONNECT_HEALTH_TIMEOUT_MS = 5_000;
const DATABASE_FIRST_QUERY_TIMEOUT_MS = 3_000;
const DATABASE_RECONNECT_QUERY_TIMEOUT_MS = 7_000;

export function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return databaseUrl;
}

function databaseSsl(databaseUrl: string) {
  const hostname = new URL(databaseUrl).hostname;
  if (hostname === "127.0.0.1" || hostname === "localhost") return false;
  return "require" as const;
}

function createSqlClient() {
  const databaseUrl = getDatabaseUrl();
  return postgres(databaseUrl, {
    max: 5,
    prepare: false,
    // Interactive auth/admin requests should fail promptly if the pooler is unreachable.
    connect_timeout: 4,
    // Keep healthy connections warm during normal navigation. If Cloud Run resumes
    // with a stale TCP socket, withSqlReconnect below detects and replaces it.
    idle_timeout: 300,
    ssl: databaseSsl(databaseUrl),
  });
}

export function getSqlClient() {
  if (!globalForDatabase.couponSharePostgres) {
    globalForDatabase.couponSharePostgres = createSqlClient();
  }
  return globalForDatabase.couponSharePostgres;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function recycleSqlClient(sql: DatabaseClient) {
  if (globalForDatabase.couponSharePostgres === sql) {
    globalForDatabase.couponSharePostgres = undefined;
  }

  // A dead socket can make teardown hang too. Give postgres-js a very short
  // cleanup window and never let cleanup block creation of the replacement client.
  await Promise.race([
    sql.end({ timeout: 0.1 }).catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, 250)),
  ]);
}

export async function withSqlReconnect<T>(operation: (sql: DatabaseClient) => Promise<T>) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= DATABASE_RECONNECT_ATTEMPTS; attempt += 1) {
    const sql = getSqlClient();
    const healthTimeout = attempt === 1
      ? DATABASE_FIRST_HEALTH_TIMEOUT_MS
      : DATABASE_RECONNECT_HEALTH_TIMEOUT_MS;
    const queryTimeout = attempt === 1
      ? DATABASE_FIRST_QUERY_TIMEOUT_MS
      : DATABASE_RECONNECT_QUERY_TIMEOUT_MS;

    try {
      // Supabase recommends a liveness preflight for persistent postgres-js
      // clients in suspend/resume environments. A stale socket is discarded
      // before the real request is attempted again on a fresh client.
      await withTimeout(
        sql`select 1`,
        healthTimeout,
        "Database connection health check timed out.",
      );

      return await withTimeout(
        operation(sql),
        queryTimeout,
        "Database query timed out.",
      );
    } catch (error) {
      lastError = error;
      console.warn(`Database attempt ${attempt} failed; recycling connection before retry.`, error);
      await recycleSqlClient(sql);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Database connection failed after reconnect attempts.");
}

export function getDb() {
  return drizzle(getSqlClient(), { schema });
}

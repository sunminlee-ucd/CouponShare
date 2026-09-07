import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type DatabaseClient = ReturnType<typeof postgres>;

const globalForDatabase = globalThis as typeof globalThis & {
  couponSharePostgres?: DatabaseClient;
};

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

export function getSqlClient() {
  if (!globalForDatabase.couponSharePostgres) {
    const databaseUrl = getDatabaseUrl();
    globalForDatabase.couponSharePostgres = postgres(databaseUrl, {
      max: 5,
      prepare: false,
      // Interactive auth/admin requests should fail promptly if the pooler is unreachable.
      connect_timeout: 4,
      // Do not tear down a healthy TLS connection after only a few seconds of inactivity.
      // Keeping it warm avoids another Supabase pooler handshake on ordinary navigation.
      idle_timeout: 300,
      ssl: databaseSsl(databaseUrl),
    });
  }
  return globalForDatabase.couponSharePostgres;
}

export function getDb() {
  return drizzle(getSqlClient(), { schema });
}

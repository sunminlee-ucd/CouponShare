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

function databaseSsl() {
  return process.env.DATABASE_SSL === "disable" ? false : "require" as const;
}

export function getSqlClient() {
  if (!globalForDatabase.couponSharePostgres) {
    globalForDatabase.couponSharePostgres = postgres(getDatabaseUrl(), {
      max: 5,
      prepare: false,
      connect_timeout: 10,
      idle_timeout: 20,
      ssl: databaseSsl(),
    });
  }
  return globalForDatabase.couponSharePostgres;
}

export function getDb() {
  return drizzle(getSqlClient(), { schema });
}

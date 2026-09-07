import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("admin summary retries on a fresh database client instead of timing out in the browser", async () => {
  const [database, summaryRoute, summaryClient, healthRoute] = await Promise.all([
    read("db/index.ts"),
    read("app/api/admin/summary/route.ts"),
    read("app/admin/AdminDashboardSummary.tsx"),
    read("app/api/database/route.ts"),
  ]);

  assert.match(database, /export async function withSqlReconnect/);
  assert.match(database, /sql`select 1`/);
  assert.match(database, /DATABASE_RECONNECT_ATTEMPTS = 2/);
  assert.match(database, /globalForDatabase\.couponSharePostgres = undefined/);
  assert.match(database, /sql\.end\(\{ timeout: 0\.1 \}\)/);
  assert.match(database, /idle_timeout: 300/);

  assert.match(summaryRoute, /withSqlReconnect/);
  assert.doesNotMatch(summaryRoute, /Admin summary query timed out/);
  assert.doesNotMatch(summaryRoute, /withTimeout\(/);

  assert.doesNotMatch(summaryClient, /AbortController/);
  assert.doesNotMatch(summaryClient, /controller\.abort/);
  assert.match(summaryClient, /fetch\("\/api\/admin\/summary"/);

  assert.match(healthRoute, /withSqlReconnect/);
});

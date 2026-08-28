import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin can gate normal app access with persistent maintenance mode", async () => {
  const [state, adminApi, publicApi, proxy, page, client, adminPanel, tabs, layout, migration] = await Promise.all([
    readFile(new URL("../app/maintenance-mode.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/maintenance/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/maintenance-status/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/maintenance/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/maintenance/MaintenanceStatusClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminMaintenancePanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminPrimaryTabs.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260828110000_app_settings_maintenance.sql", import.meta.url), "utf8"),
  ]);

  assert.match(state, /create table if not exists public\.app_settings/);
  assert.match(state, /MAINTENANCE_KEY = "maintenance_mode"/);
  assert.match(state, /CACHE_MS = 3_000/);
  assert.match(state, /on conflict \(key\) do update/);
  assert.match(migration, /maintenance_mode/);

  assert.match(adminApi, /verifyAdminToken/);
  assert.match(adminApi, /requestHasSameOrigin/);
  assert.match(adminApi, /readMaintenanceMode\(\{ fresh: true \}\)/);
  assert.match(adminApi, /setMaintenanceMode\(body\.enabled\)/);
  assert.match(publicApi, /readMaintenanceMode/);
  assert.match(publicApi, /retry-after/);

  assert.match(proxy, /readMaintenanceMode/);
  assert.match(proxy, /maintenanceBypassPath/);
  assert.match(proxy, /pathname === "\/maintenance"/);
  assert.match(proxy, /pathname === "\/api\/maintenance-status"/);
  assert.match(proxy, /if \(isAdmin \|\| maintenanceBypassPath\(pathname\)\)/);
  assert.match(proxy, /if \(await readMaintenanceMode\(\)\)/);
  assert.match(proxy, /verifyMaintenanceTestToken/);
  assert.match(proxy, /return maintenanceResponse\(request\)/);
  assert.match(proxy, /new URL\("\/maintenance", request\.url\)/);
  assert.match(proxy, /error: "maintenance"/);
  assert.match(proxy, /status: 503/);

  assert.match(page, /readMaintenanceMode\(\{ fresh: true \}\)/);
  assert.match(page, /redirect\("\/login"\)/);
  assert.match(client, /\/api\/maintenance-status/);
  assert.match(client, /window\.location\.replace\("\/login"\)/);
  assert.match(client, /10_000/);

  assert.match(adminPanel, /\/api\/admin\/maintenance/);
  assert.match(adminPanel, /JSON\.stringify\(\{ enabled: next \}\)/);
  assert.match(adminPanel, /window\.confirm/);
  assert.match(tabs, /"maintenance"/);
  assert.match(tabs, /Maintenance/);
  assert.match(layout, /AdminMaintenancePanel/);
  assert.match(layout, /admin-maintenance-slot/);
});

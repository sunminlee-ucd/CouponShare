import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps login, main navigation and admin shell off avoidable slow paths", async () => {
  const [db, authServer, callback, oauthExchange, publicRuntime, maintenanceGuard, maintenanceAccess, proxy, adminPage, adminSummary] = await Promise.all([
    readFile(new URL("../db/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/callback/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/oauth/exchange/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/PublicRuntime.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/MaintenancePageGuard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/maintenance-access/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminDashboardSummary.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(db, /connect_timeout: 4/);
  assert.match(db, /idle_timeout: 300/);

  assert.match(authServer, /SUPABASE_REQUEST_TIMEOUT_MS = 4_000/);
  assert.match(authServer, /fetchWithTimeout/);
  assert.match(authServer, /user: validSupabaseUser\(result\.user\)/);
  assert.match(authServer, /const \[existing\] = await sql/);
  assert.ok(authServer.indexOf("const [existing] = await sql") < authServer.indexOf("return sql.begin"));
  assert.doesNotMatch(authServer, /update profiles set updated_at = now\(\) where id = \$\{linked\.id\}/);

  assert.match(callback, /authSession\.user \?\? await verifySupabaseAccessToken\(authSession\.accessToken\)/);
  assert.match(oauthExchange, /authSession\.user \?\? await verifySupabaseAccessToken\(authSession\.accessToken\)/);

  assert.match(publicRuntime, /BACKGROUND_START_DELAY_MS = 1_200/);
  assert.match(publicRuntime, /MaintenancePageGuard/);
  assert.match(publicRuntime, /backgroundReady && showAppChrome && <NotificationCenter/);
  assert.match(publicRuntime, /backgroundReady && isDunnes && <TodayUsedVouchersPanel/);

  assert.match(proxy, /requiresBlockingMaintenanceCheck/);
  assert.match(proxy, /pathname\.startsWith\("\/api\/"\) \|\| !isReadOnlyMethod\(request\)/);
  assert.match(proxy, /if \(requiresBlockingMaintenanceCheck\(request\)\)/);
  assert.ok(
    proxy.indexOf("if (requiresBlockingMaintenanceCheck(request))") < proxy.indexOf("if (await readMaintenanceMode())"),
  );
  assert.match(proxy, /pathname === "\/api\/maintenance-access"/);
  assert.match(maintenanceGuard, /START_DELAY_MS = 900/);
  assert.match(maintenanceGuard, /fetch\("\/api\/maintenance-access"/);
  assert.match(maintenanceGuard, /window\.location\.replace\("\/maintenance"\)/);
  assert.match(maintenanceAccess, /readMaintenanceStatus/);
  assert.match(maintenanceAccess, /verifyMaintenanceTestToken/);
  assert.match(maintenanceAccess, /testerSession\.authUserId === testerGrant\.authUserId/);

  assert.match(adminPage, /AdminDashboardSummary/);
  assert.doesNotMatch(adminPage, /getSqlClient|Admin summary query timed out/);
  assert.match(adminSummary, /fetch\("\/api\/admin\/summary"/);
});

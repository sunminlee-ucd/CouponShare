import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin can launch only approved tester accounts during maintenance", async () => {
  const [access, launcher, panel, proxy, password, session, logout] = await Promise.all([
    readFile(new URL("../app/maintenance-test-access.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/maintenance-test/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminMaintenancePanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/password/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/session/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/logout/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(access, /MAINTENANCE_TEST_COOKIE_NAME = "couponshare_maintenance_test_v1"/);
  assert.match(access, /leesunmin7212@gmail\.com/);
  assert.match(access, /atena\.zahiri73@gmail\.com/);
  assert.match(access, /isMaintenanceTestEmail/);
  assert.match(access, /HMAC/);
  assert.match(access, /HttpOnly; Secure; SameSite=Lax/);
  assert.match(access, /bindMaintenanceTesterAfterLogin/);
  assert.match(access, /grant\.email !== email/);

  assert.match(launcher, /verifyAdminToken/);
  assert.match(launcher, /requestHasSameOrigin/);
  assert.match(launcher, /readMaintenanceMode\(\{ fresh: true \}\)/);
  assert.match(launcher, /isMaintenanceTestEmail\(email\)/);
  assert.match(launcher, /createMaintenanceTestToken\(email, null\)/);
  assert.match(launcher, /clearUserAuthCookie/);
  assert.match(launcher, /login\?maintenanceTest=1/);

  assert.match(panel, /TEST_ACCOUNTS/);
  assert.match(panel, /leesunmin7212@gmail\.com/);
  assert.match(panel, /atena\.zahiri73@gmail\.com/);
  assert.match(panel, /\/api\/admin\/maintenance-test/);
  assert.match(panel, /openTesterLogin/);
  assert.match(panel, /window\.location\.assign\(result\.loginUrl\)/);
  assert.match(panel, /disabled=\{!enabled/);

  assert.match(proxy, /maintenanceAuthPath/);
  assert.match(proxy, /MAINTENANCE_TEST_COOKIE_NAME/);
  assert.match(proxy, /verifyMaintenanceTestToken/);
  assert.match(proxy, /getAuthenticatedAccount/);
  assert.match(proxy, /account\?\.email/);
  assert.match(proxy, /testerGrant\.email/);
  assert.match(proxy, /createMaintenanceTestToken\(testerGrant\.email, pendingSession\.authUserId\)/);
  assert.match(proxy, /maintenanceTestCookie\(boundToken, true\)/);
  assert.match(proxy, /maintenanceTesterSession\.authUserId !== testerGrant\.authUserId/);

  assert.match(password, /bindMaintenanceTesterAfterLogin/);
  assert.match(password, /maintenance_test_account_required/);
  assert.match(password, /maintenanceTester\.setCookie/);
  assert.match(session, /bindMaintenanceTesterAfterLogin/);
  assert.match(session, /maintenance_test_account_required/);
  assert.match(session, /maintenanceTester\.setCookie/);
  assert.match(logout, /clearMaintenanceTestCookie/);
});

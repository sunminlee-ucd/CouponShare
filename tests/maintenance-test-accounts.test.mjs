import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin can switch directly into only approved tester accounts during maintenance", async () => {
  const [access, launcher, panel, proxy, password, session, callback, logout] = await Promise.all([
    readFile(new URL("../app/maintenance-test-access.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/maintenance-test/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminMaintenancePanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/password/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/session/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/callback/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/logout/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(access, /MAINTENANCE_TEST_COOKIE_NAME = "couponshare_maintenance_test_v1"/);
  assert.match(access, /leesunmin7212@gmail\.com/);
  assert.match(access, /atena\.zahiri73@gmail\.com/);
  assert.match(access, /isMaintenanceTestEmail/);
  assert.match(access, /HMAC/);
  assert.match(access, /HttpOnly; Secure; SameSite=Lax/);
  assert.match(access, /authUserId: string/);
  assert.doesNotMatch(access, /PREAUTH_SECONDS|bindMaintenanceTesterAfterLogin/);

  assert.match(launcher, /verifyAdminToken/);
  assert.match(launcher, /requestHasSameOrigin/);
  assert.match(launcher, /readMaintenanceMode\(\{ fresh: true \}\)/);
  assert.match(launcher, /isMaintenanceTestEmail\(email\)/);
  assert.match(launcher, /from auth\.users/);
  assert.match(launcher, /linkAuthenticatedProfile\(account\.id, ""\)/);
  assert.match(launcher, /createUserAuthToken\(account\.id, profile\.profileId\)/);
  assert.match(launcher, /createMaintenanceTestToken\(email, account\.id\)/);
  assert.match(launcher, /userAuthCookie\(userToken, false\)/);
  assert.match(launcher, /maintenanceTestCookie\(testerToken\)/);
  assert.match(launcher, /appUrl: "\/"/);
  assert.doesNotMatch(launcher, /loginUrl|maintenanceTest=1/);

  assert.match(panel, /TEST_ACCOUNTS/);
  assert.match(panel, /leesunmin7212@gmail\.com/);
  assert.match(panel, /atena\.zahiri73@gmail\.com/);
  assert.match(panel, /\/api\/admin\/maintenance-test/);
  assert.match(panel, /openTesterAccess/);
  assert.match(panel, /window\.location\.assign\(result\.appUrl\)/);
  assert.match(panel, /disabled=\{!enabled/);

  assert.match(proxy, /MAINTENANCE_TEST_COOKIE_NAME/);
  assert.match(proxy, /verifyMaintenanceTestToken/);
  assert.match(proxy, /if \(!testerGrant\) return maintenanceResponse\(request\)/);
  assert.match(proxy, /maintenanceTesterSession\.authUserId !== testerGrant\.authUserId/);
  assert.doesNotMatch(proxy, /maintenanceAuthPath|getAuthenticatedAccount|pendingSession/);

  assert.doesNotMatch(password, /bindMaintenanceTesterAfterLogin|maintenance_test_account_required/);
  assert.doesNotMatch(session, /bindMaintenanceTesterAfterLogin|maintenance_test_account_required/);
  assert.doesNotMatch(callback, /bindMaintenanceTesterAfterLogin|maintenanceTester/);
  assert.match(logout, /clearMaintenanceTestCookie/);
});

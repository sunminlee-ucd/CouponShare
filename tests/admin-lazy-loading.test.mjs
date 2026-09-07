import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin keeps public runtime and heavy section data off the initial dashboard", async () => {
  const [layout, publicRuntime, adminLayout, dashboard, vouchers, reports, users, accounts, infrastructure, maintenance, tabs] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/PublicRuntime.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/vouchers/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/reports/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/users/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/users/accounts/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/infrastructure/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/maintenance/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminPrimaryTabs.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /<PublicRuntime \/>/);
  assert.match(publicRuntime, /lazy\(\(\) => import\("\.\/AppSidebar"\)\)/);
  assert.match(publicRuntime, /lazy\(\(\) => import\("\.\/NotificationCenter"\)\)/);
  assert.match(publicRuntime, /if \(pathname\.startsWith\("\/admin"\)\) return null/);
  assert.doesNotMatch(adminLayout, /AppSidebar|NotificationCenter|AdminInfrastructurePanel|AdminMaintenancePanel|AdminAccountUsersPanel/);

  assert.match(dashboard, /Admin summary query timed out/);
  assert.match(dashboard, /risk_users/);
  assert.doesNotMatch(dashboard, /json_agg|user_error_reports r|AdminReviewTabs|AdminAccountUsersPanel|AdminMaintenancePanel/);

  assert.match(vouchers, /dunnes_reviews/);
  assert.match(vouchers, /dunnes_reports/);
  assert.match(vouchers, /AdminReviewTabs/);
  assert.match(reports, /from user_error_reports r/);
  assert.match(users, /AdminUserActivityPanel/);
  assert.match(accounts, /AdminAccountUsersPanel/);
  assert.match(infrastructure, /AdminInfrastructurePanel/);
  assert.match(maintenance, /AdminMaintenancePanel/);

  assert.match(tabs, /href: "\/admin\/users"/);
  assert.match(tabs, /href: "\/admin\/vouchers"/);
  assert.match(tabs, /href: "\/admin\/reports"/);
  assert.match(tabs, /href: "\/admin\/infrastructure"/);
  assert.match(tabs, /href: "\/admin\/maintenance"/);
});

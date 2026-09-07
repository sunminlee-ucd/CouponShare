import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin keeps public runtime and heavy section data off the initial dashboard", async () => {
  const [layout, publicRuntime, adminLayout, dashboard, summaryClient, summaryRoute, vouchers, reports, users, accounts, infrastructure, maintenance, tabs] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/PublicRuntime.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminDashboardSummary.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/summary/route.ts", import.meta.url), "utf8"),
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
  assert.match(publicRuntime, /BACKGROUND_START_DELAY_MS = 1_200/);
  assert.match(publicRuntime, /if \(isAdmin\) return null/);
  assert.match(publicRuntime, /backgroundReady && isDunnes/);
  assert.doesNotMatch(adminLayout, /AppSidebar|NotificationCenter|AdminInfrastructurePanel|AdminMaintenancePanel|AdminAccountUsersPanel/);

  assert.match(dashboard, /AdminDashboardSummary/);
  assert.doesNotMatch(dashboard, /getSqlClient|Admin summary query timed out|json_build_object|json_agg|user_error_reports r/);
  assert.match(summaryClient, /fetch\("\/api\/admin\/summary"/);
  assert.doesNotMatch(summaryClient, /AbortController|controller\.abort|3_200/);
  assert.match(summaryRoute, /withSqlReconnect/);
  assert.doesNotMatch(summaryRoute, /Admin summary query timed out|withTimeout\(|2_500/);
  assert.match(summaryRoute, /risk_users/);
  assert.doesNotMatch(summaryRoute, /json_agg|user_error_reports r|AdminReviewTabs|AdminAccountUsersPanel|AdminMaintenancePanel/);

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

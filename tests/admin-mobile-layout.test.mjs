import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin mobile layout uses compact primary navigation and route-based secondary tabs", async () => {
  const [primaryTabs, reviewTabs, usersTabs, accountTable, layout, usersPage, voucherPage, reportPage, primaryCss, accountCss, activityCss, mobileCss] = await Promise.all([
    readFile(new URL("../app/admin/AdminPrimaryTabs.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminReviewTabs.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminUsersTabs.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminAccountUsersTable.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/users/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/vouchers/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/reports/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminPrimaryTabs.css", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminAccountUsers.css", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminUserActivity.css", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminMobile.css", import.meta.url), "utf8"),
  ]);

  assert.match(primaryTabs, /Dashboard/);
  assert.match(primaryTabs, /Users/);
  assert.match(primaryTabs, /Vouchers/);
  assert.match(primaryTabs, /Reports/);
  assert.match(primaryTabs, /Infrastructure/);
  assert.match(primaryTabs, /Maintenance/);
  assert.match(primaryTabs, /href: "\/admin\/users"/);
  assert.match(primaryTabs, /href: "\/admin\/vouchers"/);
  assert.match(primaryTabs, /href: "\/admin\/reports"/);

  assert.match(reviewTabs, /type DunnesSection = "overview" \| "registered" \| "reservations" \| "review"/);
  assert.match(reviewTabs, /현황/);
  assert.match(reviewTabs, /등록 바우처/);
  assert.match(reviewTabs, /예약 중/);
  assert.match(reviewTabs, /검수·신고/);
  assert.match(reviewTabs, /activeSection === "overview"/);
  assert.match(reviewTabs, /activeSection === "registered"/);
  assert.match(reviewTabs, /activeSection === "reservations"/);
  assert.match(reviewTabs, /activeSection === "review"/);

  assert.match(usersTabs, /type UserSection = "activity" \| "accounts"/);
  assert.match(usersTabs, /\/admin\/users\/accounts/);
  assert.match(accountTable, /type AccountView = "special" \| "all"/);
  assert.match(accountTable, /특별 활동/);
  assert.match(accountTable, /전체 계정/);
  assert.match(accountTable, /admin-ordinary-users/);
  assert.match(usersPage, /<AdminUsersTabs/);
  assert.match(voucherPage, /AdminReviewTabs/);
  assert.match(reportPage, /user_error_reports/);
  assert.doesNotMatch(layout, /AdminUsersTabs|AdminInfrastructurePanel|AdminMaintenancePanel/);
  assert.match(layout, /AdminMobile\.css/);

  assert.match(primaryCss, /@media \(max-width: 560px\)/);
  assert.match(primaryCss, /\.admin-primary-tabs \{ top: 52px; \}/);
  assert.match(primaryCss, /\.admin-primary-tab small \{ display: none; \}/);
  assert.match(primaryCss, /padding: 46px 8px 12px !important/);
  assert.match(primaryCss, /\.admin-secondary-tabs/);

  assert.match(accountCss, /top: 98px/);
  assert.match(accountCss, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(accountCss, /admin-account-focus-tabs/);
  assert.match(accountCss, /admin-ordinary-users/);
  assert.match(activityCss, /grid-template-columns: 1fr 1fr/);
  assert.match(mobileCss, /data-admin-primary-tab="maintenance"/);
  assert.match(mobileCss, /top: 98px/);
});

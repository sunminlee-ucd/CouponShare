import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin mobile layout uses compact primary navigation and secondary tabs", async () => {
  const [primaryTabs, reviewTabs, usersTabs, layout, primaryCss, accountCss, activityCss, mobileCss] = await Promise.all([
    readFile(new URL("../app/admin/AdminPrimaryTabs.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminReviewTabs.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminUsersTabs.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/layout.tsx", import.meta.url), "utf8"),
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

  assert.match(reviewTabs, /type DunnesSection = "overview" \| "reservations" \| "review"/);
  assert.match(reviewTabs, /현황/);
  assert.match(reviewTabs, /예약 중/);
  assert.match(reviewTabs, /검수·신고/);
  assert.match(reviewTabs, /activeSection === "overview"/);
  assert.match(reviewTabs, /activeSection === "reservations"/);
  assert.match(reviewTabs, /activeSection === "review"/);

  assert.match(usersTabs, /type UserSection = "activity" \| "accounts"/);
  assert.match(usersTabs, /활동/);
  assert.match(usersTabs, /계정/);
  assert.match(layout, /<AdminUsersTabs/);
  assert.match(layout, /AdminMobile\.css/);

  assert.match(primaryCss, /@media \(max-width: 560px\)/);
  assert.match(primaryCss, /\.admin-primary-tabs \{ top: 52px; \}/);
  assert.match(primaryCss, /\.admin-primary-tab small \{ display: none; \}/);
  assert.match(primaryCss, /padding: 46px 8px 12px !important/);
  assert.match(primaryCss, /\.admin-secondary-tabs/);

  assert.match(accountCss, /top: 98px/);
  assert.match(accountCss, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(activityCss, /grid-template-columns: 1fr 1fr/);
  assert.match(mobileCss, /data-admin-primary-tab="maintenance"/);
  assert.match(mobileCss, /top: 98px/);
});

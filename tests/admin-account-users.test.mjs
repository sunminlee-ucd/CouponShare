import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin Users tab prioritizes special activity accounts and folds quiet accounts", async () => {
  const [panel, table, layout, css] = await Promise.all([
    readFile(new URL("../app/admin/AdminAccountUsersPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminAccountUsersTable.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminAccountUsers.css", import.meta.url), "utf8"),
  ]);

  assert.match(panel, /from auth\.users u/);
  assert.match(panel, /left join profiles p on p\.auth_user_id = u\.id/);
  assert.doesNotMatch(panel, /full outer join profiles/);
  assert.match(panel, /u\.email/);
  assert.match(panel, /raw_app_meta_data ->> 'provider'/);
  assert.doesNotMatch(panel, /md5\(p\.id/);

  assert.match(table, /실제 이메일 계정|계정 사용자 관리/);
  assert.match(table, /hasSpecialActivity/);
  assert.match(table, /today_reservations > 0/);
  assert.match(table, /today_uploads > 0/);
  assert.match(table, /today_views > 0/);
  assert.match(table, /registered_vouchers > 0/);
  assert.match(table, /risk_score > 0/);
  assert.match(table, /blocked_attempts > 0/);
  assert.match(table, /특별 활동/);
  assert.match(table, /전체 계정/);
  assert.match(table, /admin-ordinary-users/);
  assert.match(table, /<details/);
  assert.match(table, /open=\{Boolean\(normalizedQuery\)\}/);
  assert.match(table, /AdminUserResetActions/);
  assert.match(table, /block_user/);
  assert.match(table, /type="search"/);

  assert.match(layout, /AdminAccountUsersPanel/);
  assert.match(layout, /admin-account-users-slot/);
  assert.match(css, /data-admin-primary-tab="users"/);
  assert.match(css, /admin-account-users-slot/);
  assert.match(css, /admin-account-focus-tabs/);
  assert.match(css, /admin-ordinary-users/);
  assert.match(css, /admin-ordinary-users\[open\]/);
});

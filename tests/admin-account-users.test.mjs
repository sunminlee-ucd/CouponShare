import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin Users tab manages real auth accounts instead of anonymous profile labels", async () => {
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

  assert.match(table, /실제 이메일 계정/);
  assert.match(table, /프로필 연결 전/);
  assert.doesNotMatch(table, /Guest \/ 계정 미연결|provider-badge guest/);
  assert.match(table, /providerLabel/);
  assert.match(table, /AdminUserResetActions/);
  assert.match(table, /block_user/);
  assert.match(table, /type="search"/);

  assert.match(layout, /AdminAccountUsersPanel/);
  assert.match(layout, /admin-account-users-slot/);
  assert.match(css, /data-admin-primary-tab="users"/);
  assert.match(css, /admin-account-users-slot/);
});

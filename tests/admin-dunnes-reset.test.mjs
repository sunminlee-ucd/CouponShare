import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("supports compact per-user Dunnes quota resets and per-voucher registration resets", async () => {
  const [accountsPage, accountPanel, accountTable, controls, controlStyles, moderation, voucherRoute] = await Promise.all([
    readFile(new URL("../app/admin/users/accounts/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminAccountUsersPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminAccountUsersTable.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminUserResetActions.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminUserResetActions.module.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/moderation/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/user-vouchers/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(accountsPage, /AdminAccountUsersPanel/);
  assert.match(accountsPage, /requireAdminPage\("\/admin\/users\/accounts"\)/);
  assert.match(accountPanel, /today_reservations/);
  assert.match(accountPanel, /today_uploads/);
  assert.match(accountPanel, /registered_vouchers/);
  assert.match(accountPanel, /dunnes_daily_reservations/);
  assert.match(accountPanel, /api_rate_limits/);
  assert.match(accountTable, /AdminUserResetActions/);
  assert.match(accountTable, /계정 사용자 관리/);

  assert.match(controls, /reset_dunnes_reservations/);
  assert.match(controls, /reset_dunnes_upload_limit/);
  assert.match(controls, /바우처 \{registeredVouchers\}개 관리/);
  assert.match(controls, /voucher\.voucher_label/);
  assert.match(controls, /voucher\.barcode/);
  assert.match(controls, /reset_voucher/);
  assert.match(controls, /window\.confirm/);
  assert.doesNotMatch(controls, /reset_dunnes_vouchers/);

  assert.match(controlStyles, /#user-controls/);
  assert.match(controlStyles, /max-height: 430px/);
  assert.match(controlStyles, /max-height: 315px/);
  assert.match(controlStyles, /overflow: auto/);
  assert.match(controlStyles, /position: sticky/);

  assert.match(moderation, /action === "reset_dunnes_reservations"/);
  assert.match(moderation, /delete from dunnes_daily_reservations/);
  assert.match(moderation, /action === "reset_dunnes_upload_limit"/);
  assert.match(moderation, /action = 'dunnes:upload'/);
  assert.doesNotMatch(moderation, /reset_dunnes_vouchers/);

  assert.match(voucherRoute, /verifyAdminToken/);
  assert.match(voucherRoute, /requestHasSameOrigin/);
  assert.match(voucherRoute, /€5 OFF €25/);
  assert.match(voucherRoute, /€10 OFF €40/);
  assert.match(voucherRoute, /€10 OFF €50/);
  assert.match(voucherRoute, /barcode/);
  assert.match(voucherRoute, /delete from dunnes_vouchers/);
  assert.match(voucherRoute, /status <> 'reserved'/);
  assert.match(voucherRoute, /voucher_reserved/);
  assert.match(voucherRoute, /where id = \$\{voucherId\}::uuid/);
});

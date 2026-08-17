import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("supports compact per-user Dunnes quota resets and per-voucher registration resets", async () => {
  const [adminPage, controls, moderation, voucherRoute] = await Promise.all([
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminUserResetActions.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/moderation/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/user-vouchers/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(adminPage, /사용자 제한 초기화/);
  assert.match(adminPage, /today_reservations/);
  assert.match(adminPage, /today_uploads/);
  assert.match(adminPage, /registered_vouchers/);
  assert.match(adminPage, /dunnes_daily_reservations/);
  assert.match(adminPage, /api_rate_limits/);
  assert.match(adminPage, /AdminUserResetActions/);

  assert.match(controls, /reset_dunnes_reservations/);
  assert.match(controls, /reset_dunnes_upload_limit/);
  assert.match(controls, /바우처 \{registeredVouchers\}개 관리/);
  assert.match(controls, /admin-voucher-modal/);
  assert.match(controls, /max-height: 430px/);
  assert.match(controls, /overflow: auto/);
  assert.match(controls, /voucher\.voucher_label/);
  assert.match(controls, /voucher\.barcode/);
  assert.match(controls, /reset_voucher/);
  assert.match(controls, /window\.confirm/);

  assert.match(moderation, /action === "reset_dunnes_reservations"/);
  assert.match(moderation, /delete from dunnes_daily_reservations/);
  assert.match(moderation, /action === "reset_dunnes_upload_limit"/);
  assert.match(moderation, /action = 'dunnes:upload'/);

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

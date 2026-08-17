import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("supports per-user Dunnes quota and voucher registration resets", async () => {
  const [adminPage, controls, moderation] = await Promise.all([
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminUserResetActions.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/moderation/route.ts", import.meta.url), "utf8"),
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
  assert.match(controls, /reset_dunnes_vouchers/);
  assert.match(controls, /window\.confirm/);

  assert.match(moderation, /action === "reset_dunnes_reservations"/);
  assert.match(moderation, /delete from dunnes_daily_reservations/);
  assert.match(moderation, /action === "reset_dunnes_upload_limit"/);
  assert.match(moderation, /action = 'dunnes:upload'/);
  assert.match(moderation, /action === "reset_dunnes_vouchers"/);
  assert.match(moderation, /delete from dunnes_vouchers/);
  assert.match(moderation, /where owner_id = \$\{targetId\}::uuid/);
});

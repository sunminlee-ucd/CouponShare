import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("shows reserved voucher state to owners and administrators", async () => {
  const [ownerStatus, adminStatus, adminRoute, reviewTabs, layout] = await Promise.all([
    readFile(new URL("../app/MyVoucherReservationStatus.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminDunnesReservationStatus.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/dunnes-reservations/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminReviewTabs.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(ownerStatus, /voucher\.is_mine && voucher\.status === "reserved" && !voucher\.reserved_by_me/);
  assert.match(ownerStatus, /예약 중 · 다른 사용자가 사용 준비 중/);
  assert.match(ownerStatus, /REFRESH_INTERVAL_MS = 10_000/);
  assert.match(adminRoute, /where v\.status = 'reserved'/);
  assert.match(adminRoute, /v\.reserved_by is not null/);
  assert.match(adminRoute, /verifyAdminToken/);
  assert.match(adminStatus, /현재 예약 중인 Dunnes 바우처/);
  assert.match(adminStatus, /10초마다 자동 갱신/);
  assert.match(reviewTabs, /AdminDunnesReservationStatus/);
  assert.match(layout, /<MyVoucherReservationStatus \/>/);
});

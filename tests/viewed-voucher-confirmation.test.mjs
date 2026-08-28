import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("locks viewed Dunnes vouchers while deferring the fallback usage prompt during the active scan", async () => {
  const [route, component, layout, adminRoute, adminStatus] = await Promise.all([
    readFile(new URL("../app/api/dunnes-view-lock/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/ViewedVoucherUsageConfirmation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/dunnes-reservations/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminDunnesReservationStatus.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(route, /set reserved_at = null/);
  assert.match(route, /v\.reserved_at is null/);
  assert.match(route, /v\.updated_at <= now\(\) - interval '30 minutes'/);
  assert.match(component, /\.dunnes-reveal img/);
  assert.match(component, /\/api\/dunnes-view-lock/);
  assert.match(component, /ACTIVE_SCAN_SELECTOR/);
  assert.match(component, /data-dunnes-barcode-overlay/);
  assert.match(component, /document\.querySelector\(ACTIVE_SCAN_SELECTOR\)/);
  assert.match(component, /action: used \? "mark_used" : "cancel_reservation"/);
  assert.match(component, /사용했어요/);
  assert.match(component, /사용하지 않았어요/);
  assert.match(layout, /<ViewedVoucherUsageConfirmation \/>/);
  assert.match(adminRoute, /v\.reserved_at is null as needs_confirmation/);
  assert.match(adminStatus, /사용 확인 필요/);
});

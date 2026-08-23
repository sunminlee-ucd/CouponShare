import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("shows reserved Dunnes vouchers clearly to every user", async () => {
  const [status, css, layout, page] = await Promise.all([
    readFile(new URL("../app/PublicVoucherReservationStatus.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/public-voucher-reservation-status.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /dunnes-list-item busy/);
  assert.match(status, /\.dunnes-list-item\.busy/);
  assert.match(status, /badge: "예약 중"/);
  assert.match(status, /button: "예약 중"/);
  assert.match(status, /MutationObserver/);
  assert.match(status, /id: "ja"|予約中/);
  assert.match(css, /data-reservation-state="reserved"/);
  assert.match(css, /public-reservation-badge/);
  assert.match(layout, /<PublicVoucherReservationStatus \/>/);
});

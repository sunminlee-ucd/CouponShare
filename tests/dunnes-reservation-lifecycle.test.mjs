import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("expires past-date Dunnes vouchers and releases timed-out reservations consistently", async () => {
  const [tidy, adminReservations, adminReviewQueue, notifications, state] = await Promise.all([
    readFile(new URL("../app/dunnes/tidy-vouchers.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/dunnes-reservations/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/dunnes-review-queue/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/notifications/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dunnes-state/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(tidy, /expires_on < \(now\(\) at time zone 'Europe\/Dublin'\)::date/);
  assert.match(tidy, /set status = 'expired'/);
  assert.match(tidy, /reserved_at <= now\(\) - interval '30 minutes'/);
  assert.match(tidy, /reserved_at is null[\s\S]*updated_at <= now\(\) - interval '30 minutes'/);
  assert.match(tidy, /reserved_by is not null/);
  assert.match(tidy, /set status = 'available'/);
  assert.doesNotMatch(tidy, /delete from|truncate table|drop table|alter table/i);

  for (const route of [adminReservations, adminReviewQueue, notifications, state]) {
    assert.match(route, /tidyDunnesVouchers\(\)/);
  }

  assert.match(adminReservations, /v\.expires_on >= \(now\(\) at time zone 'Europe\/Dublin'\)::date/);
  assert.match(adminReservations, /v\.reserved_at > now\(\) - interval '30 minutes'/);
  assert.match(adminReviewQueue, /expires_on >= \(now\(\) at time zone 'Europe\/Dublin'\)::date/);
  assert.match(notifications, /v\.expires_on >= \(now\(\) at time zone 'Europe\/Dublin'\)::date/);
});

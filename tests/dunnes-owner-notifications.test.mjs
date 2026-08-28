import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps unused vouchers private until the original owner confirms them", async () => {
  const [helper, unusedApi, notificationsApi, popup, layout, proxy, fallback] = await Promise.all([
    readFile(new URL("../app/dunnes/unused-review.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dunnes-unused/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/notifications/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/OwnerVoucherNotification.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/ViewedVoucherUsageConfirmation.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(helper, /set reserved_by = null/);
  assert.match(helper, /reserved_at = null/);
  assert.doesNotMatch(helper, /set status = 'available'/);
  assert.doesNotMatch(helper, /user_notifications/);

  assert.match(unusedApi, /authenticatedRequestProfile/);
  assert.match(unusedApi, /requestHasSameOrigin/);
  assert.match(unusedApi, /requestUnusedReviewByImage/);
  assert.match(unusedApi, /requestUnusedReviewByVoucherId/);

  assert.match(notificationsApi, /v\.owner_id = \$\{profile\.id\}::uuid/);
  assert.match(notificationsApi, /v\.status = 'reserved'/);
  assert.match(notificationsApi, /v\.reserved_by is null/);
  assert.match(notificationsApi, /v\.reserved_at is null/);
  assert.match(notificationsApi, /owner_id = \$\{profile\.id\}::uuid/);
  assert.match(notificationsApi, /resolution === "used"/);
  assert.match(notificationsApi, /else 'available'/);
  assert.doesNotMatch(notificationsApi, /user_notifications/);

  assert.match(popup, /fetch\("\/api\/notifications"/);
  assert.match(popup, /notificationId: pending\.id/);
  assert.match(popup, /resolve\("used"\)/);
  assert.match(popup, /resolve\("released"\)/);
  assert.match(layout, /<OwnerVoucherNotification \/>/);
  assert.match(proxy, /pathname\.startsWith\("\/api\/notifications"\)/);

  assert.match(fallback, /used \? "\/api\/dunnes-vouchers" : "\/api\/dunnes-unused"/);
  assert.match(fallback, /\{ voucherId: pending\.voucher_id \}/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps unused-release owner review separate while used completion becomes informational", async () => {
  const [helper, completionApi, unusedApi, ownerReviewApi, notificationsApi, popup, layout, proxy] = await Promise.all([
    readFile(new URL("../app/dunnes/unused-review.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dunnes-complete/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dunnes-unused/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/notifications/owner-review/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/notifications/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/OwnerVoucherNotification.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
  ]);

  assert.match(helper, /set reserved_by = null/);
  assert.match(helper, /reserved_at = null/);
  assert.doesNotMatch(helper, /set status = 'available'/);

  assert.match(completionApi, /set status = 'used', used_at = now\(\), updated_at = now\(\)/);
  assert.match(completionApi, /status: "used"/);
  assert.doesNotMatch(completionApi, /requestUnusedReviewByImage/);
  assert.doesNotMatch(completionApi, /owner_confirmation/);

  assert.match(unusedApi, /requestUnusedReviewByImage\(profile\.id, body\.imageData\)/);
  assert.match(unusedApi, /status: "owner_confirmation"/);

  assert.match(ownerReviewApi, /v\.owner_id = \$\{profile\.id\}::uuid/);
  assert.match(ownerReviewApi, /v\.status = 'reserved'/);
  assert.match(ownerReviewApi, /v\.reserved_by is null/);
  assert.match(ownerReviewApi, /v\.reserved_at is null/);
  assert.match(ownerReviewApi, /resolution === "used"/);
  assert.match(ownerReviewApi, /else 'available'/);

  assert.match(notificationsApi, /app_notifications/);
  assert.match(notificationsApi, /mark_all_read/);
  assert.match(popup, /사용하지 않았다고 표시했습니다/);
  assert.match(popup, /계속 쿠폰 공유/);
  assert.match(popup, /사용완료 처리/);
  assert.match(popup, /resolve\("used"\)/);
  assert.match(popup, /resolve\("released"\)/);
  assert.match(popup, /\/api\/notifications\/owner-review/);
  assert.doesNotMatch(popup, /사용완료로 표시했습니다/);
  assert.match(layout, /<OwnerVoucherNotification \/>/);
  assert.match(layout, /<NotificationCenter \/>/);
  assert.doesNotMatch(layout, /<ViewedVoucherUsageConfirmation \/>/);
  assert.match(proxy, /pathname\.startsWith\("\/api\/notifications"\)/);
});

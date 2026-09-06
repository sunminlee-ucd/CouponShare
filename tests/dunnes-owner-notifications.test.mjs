import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps owner confirmation for unused-release review while used completion is immediate", async () => {
  const [helper, completionApi, unusedApi, notificationsApi, popup, layout, proxy] = await Promise.all([
    readFile(new URL("../app/dunnes/unused-review.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dunnes-complete/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dunnes-unused/route.ts", import.meta.url), "utf8"),
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

  assert.match(notificationsApi, /v\.owner_id = \$\{profile\.id\}::uuid/);
  assert.match(notificationsApi, /v\.status = 'reserved'/);
  assert.match(notificationsApi, /v\.reserved_by is null/);
  assert.match(notificationsApi, /v\.reserved_at is null/);
  assert.match(notificationsApi, /resolution === "used"/);
  assert.match(notificationsApi, /else 'available'/);

  assert.match(popup, /사용완료로 표시했습니다/);
  assert.match(popup, /계속 쿠폰 공유/);
  assert.match(popup, /사용완료 처리/);
  assert.match(popup, /resolve\("used"\)/);
  assert.match(popup, /resolve\("released"\)/);
  assert.doesNotMatch(popup, /나중에 확인/);
  assert.doesNotMatch(popup, /snoozedId/);
  assert.match(layout, /<OwnerVoucherNotification \/>/);
  assert.doesNotMatch(layout, /<ViewedVoucherUsageConfirmation \/>/);
  assert.match(proxy, /pathname\.startsWith\("\/api\/notifications"\)/);
});

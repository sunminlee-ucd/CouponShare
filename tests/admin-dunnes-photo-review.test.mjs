import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("pending Dunnes vouchers expose photos only through the authenticated admin review flow", async () => {
  const [queueApi, imageApi, queueUi, photoUi, moderation, tabs, css] = await Promise.all([
    readFile(new URL("../app/api/admin/dunnes-review-queue/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/dunnes-voucher-image/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminDunnesReviewQueue.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminDunnesPhotoReview.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/moderation/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminReviewTabs.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/DunnesManualReview.module.css", import.meta.url), "utf8"),
  ]);

  assert.match(queueApi, /review_status = 'pending'/);
  assert.match(queueApi, /barcode/);
  assert.match(queueApi, /membership_image_data is not null as has_membership_image/);
  assert.doesNotMatch(queueApi, /select[\s\S]{0,200}image_data\s*,/);

  assert.match(imageApi, /verifyAdminToken/);
  assert.match(imageApi, /membership_image_data as image_data/);
  assert.match(imageApi, /cache-control": "private, no-store, max-age=0"/);
  assert.match(imageApi, /x-content-type-options": "nosniff"/);

  assert.match(tabs, /AdminDunnesReviewQueue/);
  assert.match(queueUi, /자동 승인 실패 · 직접 사진 검수/);
  assert.match(photoUi, /사진 확인 후 승인/);
  assert.match(photoUi, /manualReviewConfirmed/);
  assert.match(photoUi, /photo_checked/);
  assert.match(photoUi, /dunnes-voucher-image/);

  assert.match(moderation, /manualReviewConfirmed !== "photo_checked"/);
  assert.match(moderation, /Photo review confirmation required/);
  assert.match(moderation, /Required review image unavailable/);

  assert.match(css, /button\[name="action"\]\[value="approve_dunnes"\]/);
  assert.match(css, /display: none/);
});

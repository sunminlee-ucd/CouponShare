import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin can identify registered Dunnes vouchers and their owner accounts before reviewing them", async () => {
  const [queueApi, imageApi, queueUi, photoUi, moderation, tabs, css] = await Promise.all([
    readFile(new URL("../app/api/admin/dunnes-review-queue/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/dunnes-voucher-image/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminDunnesReviewQueue.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminDunnesPhotoReview.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/moderation/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminReviewTabs.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/DunnesManualReview.module.css", import.meta.url), "utf8"),
  ]);

  assert.match(queueApi, /from dunnes_vouchers v/);
  assert.match(queueApi, /join profiles p on p\.id = v\.owner_id/);
  assert.match(queueApi, /left join auth\.users u on u\.id = p\.auth_user_id/);
  assert.match(queueApi, /u\.email as owner_email/);
  assert.match(queueApi, /owner_profile_id/);
  assert.match(queueApi, /owner_auth_user_id/);
  assert.match(queueApi, /owner_provider/);
  assert.match(queueApi, /v\.review_status in \('approved', 'pending'\)/);
  assert.match(queueApi, /v\.status in \('available', 'reserved'\)/);
  assert.match(queueApi, /v\.barcode/);
  assert.match(queueApi, /v\.membership_image_data is not null as has_membership_image/);
  assert.match(queueApi, /v\.status = 'reserved'[\s\S]*v\.reserved_by is null[\s\S]*v\.reserved_at is null[\s\S]*v\.used_at is null[\s\S]*as usage_confirmation_pending/);
  assert.doesNotMatch(queueApi, /select[\s\S]{0,200}image_data\s*,/);

  assert.match(imageApi, /verifyAdminToken/);
  assert.match(imageApi, /membership_image_data as image_data/);
  assert.match(imageApi, /cache-control": "private, no-store, max-age=0"/);
  assert.match(imageApi, /x-content-type-options": "nosniff"/);

  assert.match(tabs, /id: "registered", label: "등록 바우처"/);
  assert.match(tabs, /activeSection === "registered" && <AdminDunnesReviewQueue/);
  assert.match(queueUi, /현재 등록된 Dunnes 바우처/);
  assert.match(queueUi, /등록 계정/);
  assert.match(queueUi, /owner_email/);
  assert.match(queueUi, /owner_profile_id/);
  assert.match(queueUi, /providerLabel/);
  assert.match(queueUi, /barcode\.slice\(-4\)/);
  assert.match(queueUi, /사용완료 확인 대기/);
  assert.match(queueUi, /usageConfirmationPending=\{review\.usage_confirmation_pending\}/);
  assert.match(queueUi, /reviewStatus=\{review\.review_status\}/);
  assert.match(queueUi, /REVIEW_REFRESH_INTERVAL_MS = 10_000/);
  assert.match(queueUi, /window\.setInterval/);
  assert.match(queueUi, /visibilitychange/);
  assert.match(queueUi, /window\.addEventListener\("focus"/);
  assert.match(queueUi, /document\.visibilityState === "visible"/);
  assert.match(queueUi, /cache: "no-store"/);

  assert.match(photoUi, /usageConfirmationPending/);
  assert.match(photoUi, /예약 사용자가 이미 사용완료를 눌렀습니다/);
  assert.match(photoUi, /value="mark_dunnes_used"/);
  assert.match(photoUi, />사용완료 처리</);
  assert.match(photoUi, /name="expiresOn"/);
  assert.match(photoUi, /value="update_dunnes_expiry"/);
  assert.match(photoUi, /만료일 저장/);
  assert.match(photoUi, /등록 취소/);
  assert.match(photoUi, /reviewStatus === "pending"/);
  assert.match(photoUi, /manualReviewConfirmed/);
  assert.match(photoUi, /photo_checked/);
  assert.match(photoUi, /dunnes-voucher-image/);

  assert.match(moderation, /action === "mark_dunnes_used"/);
  assert.match(moderation, /set[\s\S]*status = 'used'[\s\S]*used_at = now\(\)/);
  assert.match(moderation, /and status = 'reserved'[\s\S]*and reserved_by is null[\s\S]*and reserved_at is null[\s\S]*and used_at is null/);
  assert.match(moderation, /Voucher is not awaiting usage confirmation/);
  assert.match(moderation, /action === "update_dunnes_expiry"/);
  assert.match(moderation, /validDateInput/);
  assert.match(moderation, /expires_on = \$\{expiresOn\}::date/);
  assert.match(moderation, /status = 'reserved'/);
  assert.match(moderation, /reserved_by = case/);
  assert.match(moderation, /action === "reject_dunnes"/);
  assert.match(moderation, /set status = 'rejected', review_status = 'rejected'/);

  assert.match(moderation, /manualReviewConfirmed !== "photo_checked"/);
  assert.match(moderation, /Photo review confirmation required/);
  assert.match(moderation, /Required review image unavailable/);

  assert.match(css, /\.expiryForm/);
  assert.match(css, /\.expiryField/);
  assert.match(css, /button\[name="action"\]\[value="approve_dunnes"\]/);
  assert.match(css, /display: none/);
});

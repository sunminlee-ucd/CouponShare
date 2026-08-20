import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("auto-approves only server-verified Dunnes voucher images", async () => {
  const [review, route] = await Promise.all([
    readFile(new URL("../app/dunnes/auto-review.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dunnes-vouchers/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(review, /await import\("tesseract\.js"\)/);
  assert.match(review, /voucher_barcode_not_read/);
  assert.match(review, /voucher_type_mismatch/);
  assert.match(review, /voucher_identity_unclear/);
  assert.match(review, /voucher_expiry_mismatch/);
  assert.match(review, /membership_barcode_not_read/);
  assert.match(review, /membership_identity_unclear/);
  assert.match(review, /autoApprove: reasons\.length === 0/);
  assert.match(review, /automatic_review_unavailable/);

  assert.match(route, /reviewDunnesUploadImages/);
  assert.match(route, /const reviewStatus = review\.autoApprove \? "approved" : "pending"/);
  assert.match(route, /expires_on, review_status/);
  assert.doesNotMatch(route, /body\.reviewStatus/);
});

test("keeps duplicate and rejected Dunnes voucher history out of automatic approval", async () => {
  const [route, moderation] = await Promise.all([
    readFile(new URL("../app/api/dunnes-vouchers/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/moderation/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(route, /where barcode = \$\{barcode\}/);
  assert.match(route, /md5\(image_data\) = md5\(\$\{imageData\}\)/);
  assert.match(route, /set status = 'expired'/);
  assert.doesNotMatch(route, /delete from dunnes_vouchers\s+where expires_on/);
  assert.match(route, /set status = 'rejected', review_status = 'rejected'/);
  assert.match(moderation, /action === "reject_dunnes"/);
  assert.match(moderation, /set status = 'rejected', review_status = 'rejected'/);
  assert.doesNotMatch(moderation, /action === "reject_dunnes"[\s\S]{0,160}delete from dunnes_vouchers/);
});

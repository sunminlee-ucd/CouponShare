import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("live Dunnes upload auto-approves basic-valid vouchers without server OCR", async () => {
  const [review, route] = await Promise.all([
    readFile(new URL("../app/dunnes/auto-review.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dunnes-vouchers/route.ts", import.meta.url), "utf8"),
  ]);

  // Keep the pure evidence helpers available for future tooling, but do not run OCR in the live registration path.
  assert.doesNotMatch(review, /await import\("tesseract\.js"\)|createWorker\(/);
  assert.match(review, /voucher_barcode_not_read/);
  assert.match(review, /voucher_type_mismatch/);
  assert.match(review, /voucher_expiry_mismatch/);
  assert.doesNotMatch(route, /reviewDunnesUploadImages/);
  assert.match(route, /import type \{ VoucherType \}/);
  assert.match(route, /DAILY_UPLOAD_LIMIT = 5/);
  assert.match(route, /ACTIVE_VOUCHER_LIMIT = 5/);
  assert.match(route, /review_status/);
  assert.match(route, /'approved'/);
  assert.doesNotMatch(route, /body\.reviewStatus/);
});

test("uses the recurring structure of real Dunnes discount voucher screenshots", async () => {
  const review = await readFile(new URL("../app/dunnes/auto-review.ts", import.meta.url), "utf8");

  assert.match(review, /knownDunnesVoucherBarcodePattern/);
  assert.match(review, /227\|270/);
  assert.match(review, /function hasMatchingSpendRule/);
  assert.match(review, /GROCERIES/);
  assert.match(review, /function hasTermsMarker/);
  assert.match(review, /CONDITIONS/);
  assert.match(review, /DUNNE5/);
  assert.match(review, /0FF/);
  assert.match(review, /MIN_VOUCHER_OCR_CONFIDENCE = 45/);
  assert.match(review, /hasCouponStructure/);
  assert.match(review, /Reading the exact printed number is our practical proof that the barcode area is clear enough/);
  assert.match(review, /Expires Today\/Sunday/);
  assert.match(review, /Voucher valid for 7 days/);
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

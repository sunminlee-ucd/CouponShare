import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps the enlarged scan stable and sends usage to owner confirmation", async () => {
  const [enhancer, flow, completionApi, membershipApi, review] = await Promise.all([
    readFile(new URL("../app/dunnes/DunnesBarcodeEnhancer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/VoucherScanFlow.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dunnes-complete/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dunnes-membership/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/unused-review.ts", import.meta.url), "utf8"),
  ]);

  assert.match(enhancer, /couponshare:dunnes-scan-lightbox-action/);
  assert.match(enhancer, /couponshare:dunnes-scan-completion-error/);
  assert.match(enhancer, /originalActions/);
  assert.match(enhancer, /originalBack/);
  assert.match(enhancer, /originalComplete/);
  assert.match(enhancer, /✓ 사용완료/);
  assert.match(enhancer, /if \(action !== "complete"\) destroyOriginalLightbox\(\)/);
  assert.match(enhancer, /primaryButton\.disabled = true/);
  assert.match(enhancer, /primaryButton\.textContent = copy\.saving/);
  assert.doesNotMatch(enhancer, /toggleZoom/);
  assert.doesNotMatch(enhancer, /originalImageZoomed/);
  assert.doesNotMatch(enhancer, /fullImage\.addEventListener\("click"/);

  assert.match(flow, /사용완료/);
  assert.match(flow, /이전으로/);
  assert.doesNotMatch(flow, /사용 안함/);
  assert.doesNotMatch(flow, /confirming/);
  assert.doesNotMatch(flow, /completeVoucher\(false\)/);
  assert.match(flow, /fetch\("\/api\/dunnes-complete"/);
  assert.match(flow, /JSON\.stringify\(\{ imageData \}\)/);
  assert.match(flow, /detail\.action === "complete"/);
  assert.match(flow, /LIGHTBOX_COMPLETION_ERROR_EVENT/);
  assert.match(flow, /window\.dispatchEvent\(new CustomEvent\(LIGHTBOX_COMPLETION_ERROR_EVENT/);
  assert.match(flow, /membershipImageData\) setStage\("membership"\)/);

  assert.match(completionApi, /requestHasSameOrigin\(request\)/);
  assert.match(completionApi, /authenticatedRequestProfile\(request\)/);
  assert.match(completionApi, /requestUnusedReviewByImage\(profile\.id, imageData\)/);
  assert.match(completionApi, /status: "owner_confirmation"/);
  assert.doesNotMatch(completionApi, /set status = 'used'/);
  assert.doesNotMatch(completionApi, /body\.used/);

  assert.match(review, /set reserved_by = null/);
  assert.match(review, /reserved_at = null/);
  assert.doesNotMatch(review, /set status = 'available'/);

  assert.match(membershipApi, /reserved_by = \$\{profile\.id\}::uuid/);
  assert.match(membershipApi, /membership_required = true/);
});

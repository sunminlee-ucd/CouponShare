import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("opens the final voucher enlarged and resolves usage directly while keeping ValueClub available", async () => {
  const [enhancer, flow, display, styles, completionApi, membershipApi] = await Promise.all([
    readFile(new URL("../app/dunnes/DunnesBarcodeEnhancer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/VoucherScanFlow.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/VoucherBarcodeDisplay.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/VoucherScanFlow.module.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dunnes-complete/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dunnes-membership/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(enhancer, /VoucherScanFlow/);
  assert.match(enhancer, /couponshare:dunnes-scan-lightbox-close/);
  assert.match(enhancer, /requestCloseOriginalLightbox/);
  assert.match(flow, /쿠폰 사용 상태/);
  assert.match(flow, /사용 안함/);
  assert.match(flow, /사용 완료/);
  assert.doesNotMatch(flow, /정말 사용 완료하셨습니까\?/);
  assert.match(flow, /completeVoucher\(false\)/);
  assert.match(flow, /completeVoucher\(true\)/);
  assert.match(flow, /fetch\("\/api\/dunnes-complete"/);
  assert.match(flow, /JSON\.stringify\(\{ imageData, used \}\)/);
  assert.match(flow, /window\.location\.reload\(\)/);

  assert.match(display, /autoOpen/);
  assert.match(display, /triggerRef\.current\.click\(\)/);
  assert.match(display, /data-dunnes-scan-kind="voucher"/);
  assert.match(flow, /<VoucherBarcodeDisplay[^>]+autoOpen/);

  assert.match(flow, /fetch\("\/api\/dunnes-membership"/);
  assert.match(flow, /backToMembership: "이전으로"/);
  assert.match(flow, /backToVoucher: "할인쿠폰"/);
  assert.match(flow, /setStage\("membership"\)/);
  assert.match(flow, /setStage\("voucher"\)/);
  assert.match(flow, /data-dunnes-scan-kind="membership"/);
  assert.match(flow, /ValueClub Card full voucher/);

  assert.match(completionApi, /requestHasSameOrigin\(request\)/);
  assert.match(completionApi, /authenticatedRequestProfile\(request\)/);
  assert.match(completionApi, /const used = body\.used !== false/);
  assert.match(completionApi, /set status = 'used', used_at = now\(\)/);
  assert.match(completionApi, /set status = 'available', reserved_by = null, reserved_at = null/);
  assert.match(completionApi, /where image_data = \$\{imageData\}/);
  assert.match(completionApi, /reserved_by = \$\{profile\.id\}::uuid/);
  assert.match(completionApi, /status = 'reserved'/);

  assert.match(membershipApi, /requestHasSameOrigin\(request\)/);
  assert.match(membershipApi, /authenticatedRequestProfile\(request\)/);
  assert.match(membershipApi, /reserved_by = \$\{profile\.id\}::uuid/);
  assert.match(membershipApi, /status = 'reserved'/);
  assert.match(membershipApi, /membership_required = true/);
  assert.match(membershipApi, /membership_image_data/);

  assert.match(styles, /:global\(\.dunnes-used-check\)/);
  assert.match(styles, /\.unusedAction/);
  assert.match(styles, /\.usedAction/);
  assert.match(styles, /min-height: 54px/);
  assert.match(styles, /min-width: 112px/);
});

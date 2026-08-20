import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("confirms voucher use after the final scan and can return to ValueClub", async () => {
  const [enhancer, flow, styles, completionApi, membershipApi] = await Promise.all([
    readFile(new URL("../app/dunnes/DunnesBarcodeEnhancer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/VoucherScanFlow.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/VoucherScanFlow.module.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dunnes-complete/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dunnes-membership/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(enhancer, /VoucherScanFlow/);
  assert.match(flow, /정말 사용 완료하셨습니까\?/);
  assert.match(flow, /다시 스캔/);
  assert.match(flow, /사용 완료/);
  assert.match(flow, /setConfirming\(false\)/);
  assert.match(flow, /fetch\("\/api\/dunnes-complete"/);
  assert.match(flow, /window\.location\.reload\(\)/);

  assert.match(flow, /fetch\("\/api\/dunnes-membership"/);
  assert.match(flow, /backToMembership: "ValueClub"/);
  assert.match(flow, /backToVoucher: "할인쿠폰"/);
  assert.match(flow, /setStage\("membership"\)/);
  assert.match(flow, /setStage\("voucher"\)/);
  assert.match(flow, /data-dunnes-original-voucher-trigger="true"/);
  assert.match(flow, /ValueClub Card full voucher/);

  assert.match(completionApi, /requestHasSameOrigin\(request\)/);
  assert.match(completionApi, /authenticatedRequestProfile\(request\)/);
  assert.match(completionApi, /reserved_by = \$\{profile\.id\}::uuid/);
  assert.match(completionApi, /status = 'reserved'/);
  assert.match(completionApi, /set status = 'used', used_at = now\(\)/);
  assert.match(completionApi, /where image_data = \$\{imageData\}/);

  assert.match(membershipApi, /requestHasSameOrigin\(request\)/);
  assert.match(membershipApi, /authenticatedRequestProfile\(request\)/);
  assert.match(membershipApi, /reserved_by = \$\{profile\.id\}::uuid/);
  assert.match(membershipApi, /status = 'reserved'/);
  assert.match(membershipApi, /membership_required = true/);
  assert.match(membershipApi, /membership_image_data/);

  assert.match(styles, /:global\(\.dunnes-used-check\)/);
  assert.match(styles, /display: none !important/);
  assert.match(styles, /\.membershipImageFrame/);
  assert.match(styles, /\.headerActions button/);
  assert.match(styles, /white-space: nowrap/);
  assert.match(styles, /background: #19734c/);
});

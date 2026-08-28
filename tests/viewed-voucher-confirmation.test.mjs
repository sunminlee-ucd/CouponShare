import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("does not mount a second usage confirmation prompt after the scan flow", async () => {
  const [layout, flow, ownerPopup] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/VoucherScanFlow.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/OwnerVoucherNotification.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(layout, /ViewedVoucherUsageConfirmation/);
  assert.doesNotMatch(layout, /viewed-voucher-confirmation\.css/);
  assert.doesNotMatch(flow, /사용 안함/);
  assert.doesNotMatch(flow, /정말 사용/);
  assert.match(flow, /사용완료/);
  assert.match(flow, /fetch\("\/api\/dunnes-complete"/);
  assert.match(ownerPopup, /사용완료로 표시했습니다/);
  assert.match(ownerPopup, /계속 쿠폰 공유/);
  assert.match(ownerPopup, /사용완료 처리/);
});

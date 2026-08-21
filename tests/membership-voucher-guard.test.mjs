import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps membership voucher spend rules visible during reservation and scanning", async () => {
  const [guard, scanFlow, layout, css] = await Promise.all([
    readFile(new URL("../app/DunnesMembershipGuard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/VoucherScanFlow.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes-membership-guard.css", import.meta.url), "utf8"),
  ]);

  assert.match(guard, /€5/);
  assert.match(guard, /€25/);
  assert.match(guard, /return 30/);
  assert.match(guard, /return 50/);
  assert.match(guard, /return 60/);
  assert.match(guard, /2번 이상 위반 시 강제 탈퇴 처리됩니다/);
  assert.match(guard, /dunnes-membership-badge\.required/);
  assert.match(guard, /dunnes-reservation-warning-title/);
  assert.match(guard, /dunnes-reveal/);

  assert.match(scanFlow, /membershipRequiredTotal/);
  assert.match(scanFlow, /€\$\{total\} 이상 구매 필수!/);
  assert.match(scanFlow, /ValueClub Card 먼저 → 할인쿠폰 나중/);
  assert.match(scanFlow, /2번 이상 위반 시 강제 탈퇴 처리됩니다/);

  assert.match(layout, /DunnesMembershipGuard/);
  assert.match(layout, /dunnes-membership-guard\.css/);
  assert.match(css, /membership-rule-main/);
  assert.match(css, /position: sticky/);
});

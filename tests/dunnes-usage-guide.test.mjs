import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("shows the concise uploader, user, and ValueClub usage guide", async () => {
  const [layout, guide, styles] = await Promise.all([
    readFile(new URL("../app/dunnes/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/DunnesUsageGuide.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/DunnesUsageGuide.module.css", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /DunnesUsageGuide/);
  assert.match(guide, /바우처를 등록하는 분/);
  assert.match(guide, /바우처를 사용하는 분/);
  assert.match(guide, /사용자가 `사용완료`를 누르면 등록자에게 개인 알림이 옵니다/);
  assert.match(guide, /`계속 공유` 또는 `사용완료 처리`/);
  assert.match(guide, /ValueClub Card 먼저 → 할인 바우처 나중/);
  assert.match(guide, /GUIDE_BUTTON_SELECTOR = "\.dunnes-hero-actions > button"/);
  assert.match(guide, /event\.stopPropagation\(\)/);
  assert.match(styles, /\.valueClub/);
  assert.match(styles, /\.order/);
});

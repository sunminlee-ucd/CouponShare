import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("builds the CouponShare experience without member names", async () => {
  await access(new URL("../dist/server/index.js", import.meta.url));
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /CouponShare/);
  assert.match(page, /dailyAnonymousId/);
  assert.match(page, /매일 ID 변경/);
  assert.match(page, /© 2026 Sunmin Lee\. All rights reserved\./);
  assert.doesNotMatch(page, /선민|지민|현우/);
});

test("includes guarded QR reveal controls and explicit security limits", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /setRevealSeconds\(12\)/);
  assert.match(page, /visibilitychange/);
  assert.match(page, /window\.addEventListener\("blur"/);
  assert.match(page, /캡처·복사를 완전히 막을 수는 없습니다/);
  assert.match(page, /Lidl QR 자체의 식별값은 바꾸지 않습니다/);
  assert.match(css, /-webkit-touch-callout:\s*none/);
  assert.match(css, /\.modal-backdrop[^}]*background:\s*#09160f/);
});

import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("builds the CouponShare experience without member names", async () => {
  await access(new URL("../dist/server/index.js", import.meta.url));
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /CouponShare/);
  assert.match(page, /dailyAnonymousId/);
  assert.match(page, /getUTCFullYear/);
  assert.match(page, /maskedCardLabel/);
  assert.match(page, /소유자 비공개/);
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
  assert.match(page, /캡처·복사를 기술적으로 완전히 막을 수는 없습니다/);
  assert.match(page, /1포인트 = €0\.01/);
  assert.match(page, /내 카드 대비 최종 순이득/);
  assert.match(page, /handleQrDismiss/);
  assert.match(css, /-webkit-touch-callout:\s*none/);
});

test("keeps search language user-friendly and protects the admin route", async () => {
  const [page, admin] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(page, /LIKE\s*&apos;/);
  assert.match(page, /검색 결과 \{visibleCouponCount\}개/);
  assert.match(admin, /requireChatGPTUser\("\/admin"\)/);
  assert.match(admin, /QR 원본 비노출/);
});

test("activates available Lidl coupons and excludes used coupons", async () => {
  const [page, importer, bookmarklet, storage, content] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lidl-import/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lidl-import/bookmarklet.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lidl-import/storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../browser-extension/lidl-importer/content.js", import.meta.url), "utf8"),
  ]);
  assert.match(page, /Lidl 웹에서 쿠폰 가져오기/);
  assert.match(importer, /https:\/\/www\.lidl\.ie\/prm\/promotions-list/);
  assert.match(importer, /package=com\.android\.chrome/);
  assert.match(importer, /Chrome에서 Lidl 열기/);
  assert.match(importer, /Lidl 주소 복사/);
  assert.match(importer, /이미 Safari라면 바로 열기/);
  assert.match(importer, /function updateMaxUnits/);
  assert.match(importer, /type="number" min="1" max="99"/);
  assert.match(importer, /localStorage\.setItem\(LIDL_IMPORT_STORAGE_KEY/);
  assert.match(bookmarklet, /\.promotions \.promotion\[data-testid\]/);
  assert.match(bookmarklet, /maxUnits: 1/);
  assert.match(bookmarklet, /getActivateButton\(card\)/);
  assert.match(bookmarklet, /button\.click\(\)/);
  assert.match(bookmarklet, /isUnavailable/);
  assert.match(bookmarklet, /redeemed\|expired/);
  assert.match(bookmarklet, /newlyActivated/);
  assert.match(importer, /새로 활성화/);
  assert.match(importer, /사용·만료 제외/);
  assert.doesNotMatch(bookmarklet, /AbortController|fetch\(|waitFor\("\.detail"\)/);
  assert.match(storage, /coupon\?\.activated === true/);
  assert.match(storage, /Math\.floor\(coupon\.maxUnits\)/);
  assert.match(content, /maxUnits: 1/);
  assert.match(content, /filter\(\(coupon\) => coupon\.activated === true\)/);
  assert.match(content, /isUnavailableCard/);
  assert.doesNotMatch(content, /fetch\(|unitMatch/);
  assert.doesNotMatch(`${bookmarklet}\n${content}`, /document\.cookie|password|localStorage/);
});

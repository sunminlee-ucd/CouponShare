import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("builds the CouponShare experience without member names", async () => {
  await access(new URL("../dist/server/index.js", import.meta.url));
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /CouponShare/);
  assert.match(page, /dailyAnonymousId/);
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
  assert.match(page, /추천 QR<\/h2>/);
  assert.doesNotMatch(page, /오늘의 공유 코드/);
  assert.match(css, /-webkit-touch-callout:\s*none/);
  assert.match(css, /\.modal-backdrop[^}]*background:\s*#09160f/);
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
  assert.match(admin, /읽기 전용 미리보기/);
});

test("provides mobile Lidl import with local detail lookup and no credential collection", async () => {
  const [page, importer, bookmarklet, manifest, content, popup] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lidl-import/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lidl-import/bookmarklet.ts", import.meta.url), "utf8"),
    readFile(new URL("../browser-extension/lidl-importer/manifest.json", import.meta.url), "utf8"),
    readFile(new URL("../browser-extension/lidl-importer/content.js", import.meta.url), "utf8"),
    readFile(new URL("../browser-extension/lidl-importer/popup.js", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Lidl 웹에서 쿠폰 가져오기/);
  assert.match(page, /<a className="web-import-link" href="\/lidl-import">/);
  assert.doesNotMatch(page, /import Link from "next\/link"/);
  assert.match(page, /await import\("tesseract\.js"\)/);
  assert.doesNotMatch(page, /import \{ createWorker \} from "tesseract\.js"/);
  assert.match(importer, /https:\/\/www\.lidl\.ie\/prm\/promotions-list/);
  assert.match(importer, /candidate\.source\?\.host === "www\.lidl\.ie"/);
  assert.match(importer, /CouponShare 가져오기/);
  assert.match(bookmarklet, /\.promotions \.promotion\[data-testid\]/);
  assert.match(bookmarklet, /credentials: "include"/);
  assert.match(bookmarklet, /detailFailures/);
  assert.match(manifest, /https:\/\/www\.lidl\.ie\/\*/);
  assert.match(content, /latestLidlImport/);
  assert.match(content, /redactSensitive/);
  assert.doesNotMatch(`${bookmarklet}\n${content}`, /document\.cookie|password|localStorage/);
  assert.match(popup, /couponshare-lidl-/);
});

import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("includes a reproducible Google Cloud Run container deployment", async () => {
  const [dockerfile, cloudbuild, deployScript, viteConfig, pnpmWorkspace] = await Promise.all([
    readFile(new URL("../Dockerfile", import.meta.url), "utf8"),
    readFile(new URL("../cloudbuild.yaml", import.meta.url), "utf8"),
    readFile(new URL("../scripts/deploy-cloud-run.ps1", import.meta.url), "utf8"),
    readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../pnpm-workspace.yaml", import.meta.url), "utf8"),
  ]);
  assert.match(dockerfile, /FROM node:22-bookworm-slim/);
  assert.match(dockerfile, /ENV PORT=8080/);
  assert.match(dockerfile, /--hostname", "0\.0\.0\.0/);
  assert.match(dockerfile, /COPY package\.json pnpm-lock\.yaml pnpm-workspace\.yaml/);
  assert.match(pnpmWorkspace, /allowBuilds:/);
  assert.match(pnpmWorkspace, /esbuild: true/);
  assert.match(pnpmWorkspace, /tesseract\.js: false/);
  assert.match(cloudbuild, /couponshare-ireland/);
  assert.match(cloudbuild, /\$COMMIT_SHA/);
  assert.match(deployScript, /gcloud run deploy/);
  assert.doesNotMatch(viteConfig, /cloudflare|sites\(\)|hostingConfig/);
});

test("builds the CouponShare experience without member names", async () => {
  await access(new URL("../dist/server/index.js", import.meta.url));
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /CouponShare/);
  assert.match(page, /dailyAnonymousId/);
  assert.match(page, /getUTCFullYear/);
  assert.match(page, /maskedCardLabel/);
  assert.match(page, /소유자 이름과 전체 ID는 숨겨집니다/);
  assert.match(page, /© 2026 Sunmin Lee\. All rights reserved\./);
  assert.doesNotMatch(page, /선민|지민|현우/);
});

test("includes guarded QR reveal controls and explicit security limits", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /setRevealSeconds\(30\)/);
  assert.match(page, /activeQrCard\.isCurrentUser/);
  assert.match(page, /visibilitychange/);
  assert.match(page, /window\.addEventListener\("blur"/);
  assert.doesNotMatch(page, /캡처·복사를 기술적으로 완전히 막을 수는 없습니다/);
  assert.match(page, /pointCount \* 0\.01/);
  assert.doesNotMatch(page, /1포인트 = €0\.01/);
  assert.match(page, /내 카드 대비 최종 순이득/);
  assert.match(page, /handleQrDismiss/);
  assert.match(css, /-webkit-touch-callout:\s*none/);
});

test("confirms coupon use, removes consumed coupons, and supports undo", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /couponshare-used-coupons-v2/);
  assert.match(page, /쿠폰을 실제로 사용했나요/);
  assert.match(page, /confirmCouponsUsed/);
  assert.match(page, /usedCouponKeys\.includes/);
  assert.match(page, /쿠폰 되돌리기/);
  assert.match(page, /이 카드 QR 사용하기/);
  assert.match(page, /import\("jsqr"\)/);
  assert.match(page, /cropQrImage/);
  assert.match(page, /setQrCropStatus\("done"\)/);
  assert.match(page, /openOwnCouponCheck/);
  assert.match(page, /사용한 쿠폰 체크/);
  assert.match(page, /쿠폰 모두 활성화 후 다시 가져오기/);
  assert.match(page, /onClick=\{\(\) => openCouponCard\(member\)\}/);
  assert.match(page, /쿠폰으로 QR 열기/);
  assert.match(page, /<details className=\{member\.coupons\.length/);
  assert.match(css, /\.coupon-owner-scroll \{[^}]*overflow-y: auto/);
  assert.match(css, /overscroll-behavior: contain/);
  assert.doesNotMatch(page, /PostgreSQL|OCR 처리는 브라우저/);
  assert.match(css, /\.main-tabs/);
  assert.match(page, /activeTab/);
  assert.doesNotMatch(page, />QR 공유</);
  assert.match(page, /qrViewsRemaining/);
  assert.match(page, /내 Lidl QR/);
  assert.match(page, /나의 이번달 절약 금액/);
  assert.match(page, /나의 총 누적 절약 금액/);
  assert.match(page, /CouponShare를 통한 총 절약금액/);
  assert.match(page, /home-qr-image/);
  assert.match(css, /\.used-coupon-checklist/);
});

test("includes a portable Supabase PostgreSQL persistence layer", async () => {
  const [schema, database, wallet, qr, migration, moderationMigration, duplicateMigration, savingsMigration, envExample] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/database/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/coupon-wallet/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/coupon-wallet/qr/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202608090001_initial.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260810082146_qr_daily_limit_and_moderation.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260810090252_qr_duplicate_fingerprints.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260811093000_savings_tracking.sql", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /pgTable\("profiles"/);
  assert.match(schema, /pgTable\("coupons"/);
  assert.match(schema, /pgTable\("coupon_use_events"/);
  assert.match(schema, /savedAmount: numeric\("saved_amount"/);
  assert.match(database, /DATABASE_URL/);
  assert.match(wallet, /action === "sync"/);
  assert.match(wallet, /deleteExpiredGroupCoupons/);
  assert.match(wallet, /isCouponExpired/);
  assert.match(wallet, /action === "mark_used"/);
  assert.match(wallet, /if \(!profile\) return Response\.json\(\{ usedKeys: \[\], members: \[\] \}\)/);
  assert.match(wallet, /ALPHA_GROUP_CODE = "couponshare-alpha-v1"/);
  assert.match(wallet, /body\.action === "set_sharing"/);
  assert.match(wallet, /card\.is_shared = true/);
  assert.match(wallet, /qrViewsRemaining/);
  assert.match(qr, /qr_daily_usage/);
  assert.match(qr, /view_count < 3/);
  assert.match(qr, /daily_qr_limit/);
  assert.match(qr, /export async function GET/);
  assert.match(migration, /create table if not exists group_members/);
  assert.match(migration, /insert into storage\.buckets/);
  assert.match(moderationMigration, /create table if not exists qr_daily_usage/);
  assert.match(moderationMigration, /review_status/);
  assert.match(schema, /pgTable\("qr_daily_usage"/);
  assert.match(wallet, /duplicate_qr/);
  assert.match(wallet, /createHash\("sha256"\)/);
  assert.match(wallet, /risk_score = risk_score \+ 2/);
  assert.match(duplicateMigration, /lidl_cards_qr_fingerprint_unique_idx/);
  assert.match(duplicateMigration, /lidl_cards_qr_image_hash_unique_idx/);
  assert.match(savingsMigration, /add column if not exists saved_amount/);
  assert.match(wallet, /communityTotal/);
  assert.match(wallet, /savingsByExternalKey/);
  assert.match(envExample, /sslmode=require/);
  assert.doesNotMatch(envExample, /eyJ[A-Za-z0-9_-]+\./);
});

test("keeps search language user-friendly and protects the admin route", async () => {
  const [page, admin, proxy, moderation] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/moderation/route.ts", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(page, /LIKE\s*&apos;/);
  assert.match(page, /검색 결과 \{visibleCouponCount\}개/);
  assert.match(proxy, /ADMIN_PASSWORD/);
  assert.match(proxy, /\/admin\/:path\*/);
  assert.match(admin, /review_status/);
  assert.match(admin, /risk_score/);
  assert.match(moderation, /approve_card/);
  assert.match(moderation, /block_user/);
  assert.match(moderation, /delete from coupons where owner_id/);
  assert.match(moderation, /delete from lidl_cards where id/);
  assert.match(moderation, /is_shared = false/);
  assert.match(admin, /QR 원본·실명 비노출/);
  assert.match(admin, /거절·삭제/);
});

test("activates available Lidl coupons and excludes used coupons", async () => {
  const [page, importer, bookmarklet, storage, content, inAppNotice] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lidl-import/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lidl-import/bookmarklet.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lidl-import/storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../browser-extension/lidl-importer/content.js", import.meta.url), "utf8"),
    readFile(new URL("../app/IosInAppBrowserNotice.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /쿠폰 모두 활성화 후 다시 가져오기/);
  assert.match(importer, /https:\/\/www\.lidl\.ie\/prm\/promotions-list/);
  assert.match(importer, /COUPONSHARE_ORIGIN = "https:\/\/couponshare-ireland-493377120974\.europe-west1\.run\.app"/);
  assert.match(importer, /className="import-home-link" href=\{COUPONSHARE_ORIGIN\}/);
  assert.match(importer, /buildLidlBookmarklet\(COUPONSHARE_ORIGIN/);
  assert.doesNotMatch(importer, /buildLidlBookmarklet\(location\.origin/);
  assert.match(importer, /package=com\.android\.chrome/);
  assert.match(importer, /Lidl 쿠폰 가져오기/);
  assert.match(importer, /메인으로 돌아가기/);
  assert.match(importer, /className="import-action import-qr-next" href="\/"/);
  assert.doesNotMatch(importer, /import-step-number">2/);
  assert.doesNotMatch(importer, /Lidl 주소 복사|이미 Safari라면 바로 열기/);
  assert.match(importer, /function updateMaxUnits/);
  assert.match(importer, /type="number" min="1" max="99"/);
  assert.match(importer, /localStorage\.setItem\(LIDL_IMPORT_STORAGE_KEY/);
  assert.match(bookmarklet, /\.promotions \.promotion\[data-testid\]/);
  assert.match(bookmarklet, /maxUnits: 1/);
  assert.match(bookmarklet, /getActivateButton\(card\)/);
  assert.match(bookmarklet, /button\.click\(\)/);
  assert.match(bookmarklet, /location\.assign\("https:\/\/www\.lidl\.ie\/prm\/promotions-list"\)/);
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
  assert.match(page, /IosInAppBrowserNotice/);
  assert.match(importer, /IosInAppBrowserNotice/);
  assert.match(inAppNotice, /KAKAOTALK/);
  assert.match(inAppNotice, /INAPP/);
  assert.match(inAppNotice, /Safari용 주소 복사/);
  assert.match(inAppNotice, /destinationPath = "\/lidl-import"/);
});

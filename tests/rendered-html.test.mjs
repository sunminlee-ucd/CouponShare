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
  const [page, policyLinks] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/PolicyLinks.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /CouponShare/);
  assert.doesNotMatch(page, /admin-page-link|profile-button/);
  assert.match(page, /dailyAnonymousId/);
  assert.match(page, /getUTCFullYear/);
  assert.match(page, /maskedCardLabel/);
  assert.match(page, /소유자 이름과 전체 ID는 숨겨집니다/);
  assert.match(policyLinks, /© 2026 Sunmin Lee\. All rights reserved\./);
  assert.doesNotMatch(page, /선민|지민|현우/);
});

test("provides branded Android and iPhone home screen icons", async () => {
  const [manifest, layout] = await Promise.all([
    readFile(new URL("../public/manifest-v2.json", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    access(new URL("../public/icon-192.png", import.meta.url)),
    access(new URL("../public/icon-512.png", import.meta.url)),
    access(new URL("../public/maskable-icon-512.png", import.meta.url)),
    access(new URL("../public/apple-touch-icon.png", import.meta.url)),
  ]);
  assert.match(manifest, /"display": "standalone"/);
  assert.match(manifest, /"purpose": "maskable"/);
  assert.match(layout, /manifest: "\/manifest-v2\.json"/);
  assert.match(layout, /couponshare-apple-touch-v2\.png/);
  assert.match(layout, /shortcut:/);
  assert.match(layout, /themeColor: "#19734c"/);
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
  assert.match(page, /쿠폰 활성화 후 다시 가져오기/);
  assert.match(page, /쿠폰 활성화 후 가져오기/);
  assert.match(page, /쿠폰을 먼저 가져와 주세요/);
  assert.match(page, /importedActiveCoupons\?\.length/);
  assert.match(page, /onClick=\{\(\) => openCouponCard\(member\)\}/);
  assert.match(page, /쿠폰으로 QR 열기/);
  assert.match(page, /<details className=\{member\.coupons\.length/);
  assert.match(css, /\.coupon-owner-scroll \{[^}]*overflow-y: auto/);
  assert.match(css, /overscroll-behavior: contain/);
  assert.doesNotMatch(page, /PostgreSQL|OCR 처리는 브라우저/);
  assert.match(css, /\.main-tabs/);
  assert.match(page, /activeTab/);
  assert.match(page, /RECEIPT_SCAN_ENABLED/);
  assert.match(page, /NEXT_PUBLIC_RECEIPT_SCAN_ENABLED/);
  assert.match(page, /dunnes-primary-entry/);
  assert.match(page, /RECEIPT_SCAN_ENABLED && <div className="main-tabs"/);
  assert.match(page, /function InfoTip/);
  assert.match(page, /setClosing\(true\), 2_700/);
  assert.match(page, /setClosing\(false\);\s*\}, 3_000/);
  assert.match(page, /data-closing=\{closing\}/);
  assert.match(css, /\.community-saving \.info-tip > span \{ left: auto; right: 0; \}/);
  assert.match(css, /width: min\(180px, calc\(100vw - 56px\)\)/);
  assert.match(page, /이번 달 <InfoTip/);
  assert.doesNotMatch(page, />QR 공유</);
  assert.match(page, /qrViewsRemaining/);
  assert.match(page, /내 Lidl QR/);
  assert.match(page, /이번 달 <InfoTip/);
  assert.match(page, /누적 <InfoTip/);
  assert.match(page, /전체 <InfoTip/);
  assert.match(page, /home-qr-image/);
  assert.match(page, /qrRegistrationPrompt/);
  assert.match(page, /쿠폰을 가져왔습니다\. QR 사진을 등록해 주세요/);
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
  assert.match(wallet, /active_coupons_required/);
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

test("protects the private test with consent, quotas, and account deletion", async () => {
  const [proxy, accessRoute, accessPage, accountRoute, rateLimit, migration, cloudbuild] = await Promise.all([
    readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/access/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/access/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/account/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/rate-limit.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260814120000_private_alpha_security.sql", import.meta.url), "utf8"),
    readFile(new URL("../cloudbuild.yaml", import.meta.url), "utf8"),
  ]);
  assert.match(proxy, /verifyAccessToken/);
  assert.match(proxy, /x-content-type-options/);
  assert.match(proxy, /permissions-policy/);
  assert.match(accessRoute, /acceptedPrivacy/);
  assert.match(accessRoute, /HttpOnly; Secure; SameSite=Lax/);
  assert.match(accessPage, /개인정보처리방침/);
  assert.match(accountRoute, /delete from profiles/);
  assert.match(rateLimit, /api_rate_limits/);
  assert.match(migration, /review_status/);
  assert.match(migration, /enable row level security/);
  assert.doesNotMatch(cloudbuild, /APP_ACCESS_CODE|APP_SESSION_SECRET/);
});

test("supports free Dunnes voucher sharing and atomic reservations", async () => {
  const [page, route, schema, migration, dailyLimitMigration, membershipMigration, reportMigration, activityMigration, home, admin, css] = await Promise.all([
    readFile(new URL("../app/dunnes/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dunnes-vouchers/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260811153000_dunnes_voucher_sharing.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260811173000_dunnes_daily_reservation_limit.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260811183000_dunnes_valueclub_card.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260814143000_dunnes_voucher_reports.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260815090000_dunnes_voucher_activity.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /€5 OFF €25/);
  assert.match(page, /€10 OFF €40/);
  assert.match(page, /€10 OFF €50/);
  assert.match(page, /€10 할인/);
  assert.match(page, /tenEuroSpend/);
  assert.match(page, /30분간 예약/);
  assert.match(page, /createWorker\("eng"\)/);
  assert.match(page, /parseBarcode/);
  assert.match(page, /parseExpiry/);
  assert.match(route, /status = 'reserved'/);
  assert.match(route, /now\(\) - interval '30 minutes'/);
  assert.match(route, /dunnes_daily_reservations\.reservation_count < 3/);
  assert.match(route, /daily_reservation_limit/);
  assert.match(route, /delete from dunnes_vouchers/);
  assert.match(route, /v\.status in \('available', 'reserved'\)/);
  assert.match(route, /error: "duplicate"/);
  assert.match(route, /sameOrigin/);
  assert.match(schema, /pgTable\("dunnes_vouchers"/);
  assert.match(schema, /pgTable\("dunnes_daily_reservations"/);
  assert.match(migration, /enable row level security/);
  assert.match(dailyLimitMigration, /reservation_count between 0 and 3/);
  assert.match(membershipMigration, /membership_required boolean/);
  assert.match(route, /membership_image_data/);
  assert.match(route, /body\.action === "report"/);
  assert.match(route, /membership_not_scanned/);
  assert.match(route, /dunnes_voucher_reports/);
  assert.match(route, /body\.action === "record_view"/);
  assert.match(route, /dunnes_voucher_activity/);
  assert.match(schema, /pgTable\("dunnes_voucher_activity"/);
  assert.match(activityMigration, /event_type in \('viewed'\)/);
  assert.match(admin, /오늘 Dunnes 열람/);
  assert.match(admin, /오늘 Dunnes 사용/);
  assert.match(route, /voucherType !== "10off50"/);
  assert.match(page, /이미 만료된 바우처입니다\./);
  assert.match(page, /noticeRequiresAction/);
  assert.match(page, /window\.setTimeout\(\(\) => setNotice/);
  assert.match(page, /3_000/);
  assert.match(page, /role=\{noticeRequiresAction \? "alert" : "status"\}/);
  assert.match(page, /className="dunnes-used-check"/);
  assert.match(page, /이용 중/);
  assert.match(page, /오늘 예약 \{reservationsRemaining\}\/3회 남음/);
  assert.match(page, /멤버십 스캔 필요/);
  assert.match(page, /ValueClub Card 보기 \(30초\)/);
  assert.match(page, /멤버십 스캔 완료 → 바우처 보기/);
  assert.match(page, /문제 신고/);
  assert.match(page, /바우처가 유효하지 않음/);
  assert.match(page, /멤버십 스캔 누락/);
  assert.match(page, /expiresAt: startedAt \+ 30_000/);
  assert.match(page, /cropValueClubCard/);
  assert.match(page, /greenPixels >= analysis\.width \* 0\.06/);
  assert.match(page, /초록색 박스만 자동 자르기/);
  assert.match(page, /샘플 쿠폰 이용 방법/);
  assert.match(page, /window\.location\.assign\("\/"\)/);
  assert.match(page, /ValueClub Card를 먼저 스캔/);
  assert.match(page, /할인 바우처만 스캔/);
  assert.match(page, /const myVouchers = mine\.filter/);
  assert.match(page, /내가 등록한 바우처/);
  assert.match(page, /className="dunnes-list-item mine"/);
  assert.doesNotMatch(page, /바우처 종류<select/);
  assert.match(home, /className="dunnes-entry-card dunnes-primary-entry" href="\/dunnes"/);
  assert.doesNotMatch(home, /<strong>Dunnes 나눔<\/strong>/);
  assert.match(css, /\.dunnes-market/);
  assert.match(css, /@keyframes dunnes-alert-pulse/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /\.home-qr-card \{[^}]*order: 2/);
  assert.match(reportMigration, /unique \(voucher_id, reporter_id, reason\)/);
});

test("supports Lidl card reporting and automatic review", async () => {
  const [home, wallet, admin, moderation, schema, migration] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/coupon-wallet/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/moderation/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260814200000_lidl_card_reports.sql", import.meta.url), "utf8"),
  ]);
  assert.match(home, /reportLidlCard/);
  assert.match(home, /coupon_mismatch/);
  assert.match(home, /Lidl QR과 상관없는 이미지/);
  assert.match(wallet, /body\.action === "report_card"/);
  assert.match(wallet, /lidl_card_reports/);
  assert.match(wallet, /count\(distinct reporter_id\)/);
  assert.match(wallet, /is_shared = false/);
  assert.match(admin, /Lidl 신고/);
  assert.match(moderation, /resolve_lidl_reports/);
  assert.match(schema, /pgTable\("lidl_card_reports"/);
  assert.match(migration, /unique \(card_id, reporter_id, reason\)/);
});

test("keeps search language user-friendly and protects the admin route", async () => {
  const [page, admin, proxy, moderation, adminSession, adminLogin, adminLoginPage, adminRefresh, refreshRoute] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/moderation/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/session.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/login/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/login/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminSessionRefresh.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/refresh/route.ts", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(page, /LIKE\s*&apos;/);
  assert.match(page, /검색 결과 \{visibleCouponCount\}개/);
  assert.match(proxy, /matcher: \["\/:path\*"\]/);
  assert.match(proxy, /if \(isAdmin\) return hardened\(NextResponse\.next\(\)\)/);
  assert.doesNotMatch(proxy, /verifyAdminToken|ADMIN_COOKIE_NAME/);
  assert.doesNotMatch(proxy, /Basic realm/);
  assert.match(admin, /verifyAdminToken/);
  assert.match(admin, /redirect\("\/admin\/login\?returnTo=%2Fadmin"\)/);
  assert.doesNotMatch(admin, /create table|create index|alter table/i);
  assert.match(admin, /withTimeout/);
  assert.match(admin, /데이터 조회가 지연되고 있습니다/);
  assert.match(adminSession, /ADMIN_SESSION_DAYS = 30/);
  assert.match(adminSession, /couponshare-admin-session-v1/);
  assert.match(adminSession, /createHmac\("sha256"/);
  assert.match(adminSession, /timingSafeEqual/);
  assert.match(adminLogin, /HttpOnly; Secure; SameSite=Lax/);
  assert.match(adminLogin, /formSubmission/);
  assert.match(adminLogin, /status: 303/);
  assert.match(adminSession, /x-forwarded-host/);
  assert.match(adminSession, /allowedHosts/);
  assert.match(adminSession, /sec-fetch-site/);
  assert.match(adminLogin, /location: "\/admin"/);
  assert.match(adminLoginPage, /이용할 때마다 자동 연장됩니다/);
  assert.match(adminLoginPage, /credentials: "include"/);
  assert.match(adminLoginPage, /window\.location\.assign\("\/admin"\)/);
  assert.match(adminLoginPage, /action="\/api\/admin\/login" method="post"/);
  assert.match(adminLoginPage, /controller\.abort\(\), 10_000/);
  assert.match(adminRefresh, /\/api\/admin\/refresh/);
  assert.match(refreshRoute, /createAdminToken/);
  assert.match(moderation, /verifyAdminToken/);
  assert.match(admin, /\/api\/admin\/logout/);
  assert.match(admin, /review_status/);
  assert.match(admin, /risk_score/);
  assert.match(moderation, /approve_card/);
  assert.match(moderation, /block_user/);
  assert.match(moderation, /delete from coupons where owner_id/);
  assert.match(moderation, /delete from lidl_cards where id/);
  assert.match(moderation, /is_shared = false/);
  assert.match(admin, /QR 원본 비노출/);
  assert.match(admin, /Dunnes 바우처 검수/);
  assert.match(moderation, /approve_dunnes/);
  assert.match(moderation, /reject_dunnes/);
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
  assert.match(page, /쿠폰 활성화 후 다시 가져오기/);
  assert.match(importer, /https:\/\/www\.lidl\.ie\/prm\/promotions-list/);
  assert.match(importer, /COUPONSHARE_ORIGIN = "https:\/\/couponshare-ireland-493377120974\.europe-west1\.run\.app"/);
  assert.match(importer, /className="import-home-link" href="\/"/);
  assert.match(importer, /buildLidlBookmarklet\(COUPONSHARE_ORIGIN/);
  assert.doesNotMatch(importer, /buildLidlBookmarklet\(location\.origin/);
  assert.match(importer, /package=com\.android\.chrome/);
  assert.match(importer, /Lidl 쿠폰 가져오기/);
  assert.match(importer, /className="import-hero-action"/);
  assert.doesNotMatch(importer, /import-run-action-row/);
  assert.match(importer, /메인으로 돌아가기/);
  assert.match(importer, /hasRegisteredQr \? "\/" : "\/\?qr=register"/);
  assert.match(importer, /hasRegisteredQr \? "메인으로 돌아가기" : "QR 등록하기"/);
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

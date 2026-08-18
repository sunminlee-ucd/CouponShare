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

test("builds the CouponShare experience and branded home-screen assets", async () => {
  await access(new URL("../dist/server/index.js", import.meta.url));
  const [page, policyLinks, manifest, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/PolicyLinks.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest-v2.json", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    access(new URL("../public/icon-192.png", import.meta.url)),
    access(new URL("../public/icon-512.png", import.meta.url)),
    access(new URL("../public/maskable-icon-512.png", import.meta.url)),
    access(new URL("../public/apple-touch-icon.png", import.meta.url)),
  ]);
  assert.match(page, /CouponShare/);
  assert.match(page, /dailyAnonymousId/);
  assert.match(page, /maskedCardLabel/);
  assert.match(policyLinks, /© 2026 Sunmin Lee\. All rights reserved\./);
  assert.match(manifest, /"display": "standalone"/);
  assert.match(manifest, /"purpose": "maskable"/);
  assert.match(layout, /manifest: "\/manifest-v2\.json"/);
  assert.match(layout, /couponshare-apple-touch-v2\.png/);
});

test("keeps Supabase persistence and abuse-control tables", async () => {
  const [schema, database, wallet, qr, migration, securityMigration, envExample] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/database/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/coupon-wallet/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/coupon-wallet/qr/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202608090001_initial.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260814120000_private_alpha_security.sql", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /pgTable\("profiles"/);
  assert.match(schema, /pgTable\("coupons"/);
  assert.match(schema, /pgTable\("coupon_use_events"/);
  assert.match(schema, /pgTable\("api_rate_limits"/);
  assert.match(database, /DATABASE_URL/);
  assert.match(wallet, /action === "sync"/);
  assert.match(wallet, /action === "mark_used"/);
  assert.match(qr, /qr_daily_usage/);
  assert.match(migration, /create table if not exists group_members/);
  assert.match(securityMigration, /enable row level security/);
  assert.match(envExample, /sslmode=require/);
  assert.match(envExample, /SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(envExample, /APP_ACCESS_CODE|APP_SESSION_SECRET/);
  assert.doesNotMatch(envExample, /eyJ[A-Za-z0-9_-]+\./);
});

test("uses email password and Google account auth without an invite-code gate", async () => {
  const [proxy, login, oauth, passwordRoute, authSession, authServer, migration] = await Promise.all([
    readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/oauth/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/password/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/session.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/server.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260818070000_auth_profiles.sql", import.meta.url), "utf8"),
  ]);
  assert.match(proxy, /verifyUserAuthToken/);
  assert.match(proxy, /auth_required/);
  assert.match(proxy, /pathname === "\/login"/);
  assert.doesNotMatch(proxy, /ACCESS_COOKIE_NAME|verifyAccessToken|\/access/);
  assert.match(login, /mode === "login"/);
  assert.match(login, /mode === "signup"/);
  assert.match(login, /continueWithGoogle/);
  assert.match(login, /\/api\/auth\/password/);
  assert.doesNotMatch(login, /Continue with Apple|Apple로|socialApple/);
  assert.match(oauth, /provider !== "google"/);
  assert.doesNotMatch(oauth, /apple/i);
  assert.match(passwordRoute, /\/auth\/v1\/signup/);
  assert.match(passwordRoute, /grant_type=password/);
  assert.match(authSession, /AUTH_SESSION_SECRET/);
  assert.match(authSession, /AUTH_REQUIRED/);
  assert.match(authSession, /couponshare_user_v1/);
  assert.match(authServer, /where auth_user_id =/);
  assert.match(authServer, /where device_key =/);
  assert.match(migration, /add column if not exists auth_user_id uuid/);
});

test("supports Dunnes voucher sharing with atomic reservation limits", async () => {
  const [page, route, schema, dailyLimitMigration, activityMigration] = await Promise.all([
    readFile(new URL("../app/dunnes/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dunnes-vouchers/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260811173000_dunnes_daily_reservation_limit.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260815090000_dunnes_voucher_activity.sql", import.meta.url), "utf8"),
  ]);
  assert.match(page, /€5 OFF €25/);
  assert.match(page, /€10 OFF €40/);
  assert.match(page, /€10 OFF €50/);
  assert.match(page, /parseBarcode/);
  assert.match(page, /parseExpiry/);
  assert.match(page, /cropValueClubCard/);
  assert.match(route, /status = 'reserved'/);
  assert.match(route, /dunnes_daily_reservations\.reservation_count < 3/);
  assert.match(route, /daily_reservation_limit/);
  assert.match(route, /body\.action === "report"/);
  assert.match(route, /body\.action === "record_view"/);
  assert.match(route, /sameOrigin/);
  assert.doesNotMatch(route, /create table|create index|alter table/i);
  assert.match(schema, /pgTable\("dunnes_vouchers"/);
  assert.match(schema, /pgTable\("dunnes_daily_reservations"/);
  assert.match(dailyLimitMigration, /reservation_count between 0 and 3/);
  assert.match(activityMigration, /event_type in \('viewed'\)/);
});

test("keeps admin authentication, moderation, resets, and capacity monitoring", async () => {
  const [admin, adminLayout, moderation, adminSession, adminLogin, resetActions, infrastructure] = await Promise.all([
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/moderation/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/session.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/login/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminUserResetActions.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminInfrastructurePanel.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(admin, /verifyAdminToken/);
  assert.match(admin, /redirect\("\/admin\/login\?returnTo=%2Fadmin"\)/);
  assert.match(admin, /<AdminReviewTabs/);
  assert.match(admin, /<AdminUserResetActions/);
  assert.doesNotMatch(admin, /AdminAccessCodeCopy|accessConfiguration|초대코드/);
  assert.match(adminLayout, /AdminInfrastructurePanel/);
  assert.match(infrastructure, /pg_database_size\(current_database\(\)\)/);
  assert.match(infrastructure, /CLOUD_RUN_FREE_REQUESTS = 2_000_000/);
  assert.match(adminSession, /couponshare-admin-session-v1/);
  assert.match(adminLogin, /HttpOnly; Secure; SameSite=Lax/);
  assert.match(moderation, /approve_dunnes/);
  assert.match(moderation, /reject_dunnes/);
  assert.match(moderation, /block_user/);
  assert.match(resetActions, /reset_dunnes_reservations/);
  assert.match(resetActions, /reset_dunnes_upload_limit/);
});

test("keeps Lidl code feature-flagged and user language controls outside admin", async () => {
  const [features, home, importer, i18n, layout, login, admin, envExample] = await Promise.all([
    readFile(new URL("../app/features.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lidl-import/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);
  assert.match(features, /NEXT_PUBLIC_LIDL_ENABLED === "true"/);
  assert.match(home, /LIDL_ENABLED &&/);
  assert.match(importer, /if \(!LIDL_ENABLED\)/);
  assert.match(envExample, /NEXT_PUBLIC_LIDL_ENABLED=false/);
  assert.match(i18n, /couponshare-language-v1/);
  assert.match(i18n, /English/);
  assert.match(i18n, /فارسی/);
  assert.match(i18n, /pathname\.startsWith\("\/admin"\)/);
  assert.match(layout, /<LanguageProvider>/);
  assert.match(login, /useLanguage\(\)/);
  assert.doesNotMatch(admin, /LanguageSwitcher|useLanguage/);
});

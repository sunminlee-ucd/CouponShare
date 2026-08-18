import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("supports email password and Google auth with explicit browse entry", async () => {
  const [login, sessionRoute, oauthRoute, authSession, authServer, statusRoute, proxy, migration, admin, authControl, authControlCss, issueCss, guestGuard, dunnesLayout, dunnesRoute, publicUrl] = await Promise.all([
    readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/session/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/oauth/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/session.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/status/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260818070000_auth_profiles.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AuthStatusControl.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AuthStatusControl.module.css", import.meta.url), "utf8"),
    readFile(new URL("../app/ErrorReportButton.module.css", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/DunnesGuestActionGuard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dunnes-vouchers/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/public-url.ts", import.meta.url), "utf8"),
  ]);

  assert.match(login, /mode === "login"/);
  assert.match(login, /mode === "signup"/);
  assert.match(login, /confirmPassword/);
  assert.match(login, /password !== confirmPassword/);
  assert.match(login, /signupSuccess/);
  assert.match(login, /OAUTH_CONTEXT_STORAGE_KEY/);
  assert.match(login, /GoogleLogo/);
  assert.match(login, /#4285F4/);
  assert.match(login, /continueWithGoogle/);
  assert.match(login, /oauthBusy/);
  assert.match(login, /authProgress/);
  assert.match(login, /\/api\/auth\/password/);
  assert.match(login, /\/api\/auth\/browse/);
  assert.doesNotMatch(login, /Continue with Apple|socialApple/);

  assert.match(sessionRoute, /verifySupabaseAccessToken/);
  assert.match(sessionRoute, /linkAuthenticatedProfile/);
  assert.match(sessionRoute, /AUTO_LOGIN_COOKIE_NAME/);
  assert.match(sessionRoute, /userAuthCookie\(token, autoLogin\)/);
  assert.match(authSession, /HttpOnly; Secure; SameSite=Lax/);

  assert.match(oauthRoute, /provider !== "google"/);
  assert.doesNotMatch(oauthRoute, /apple/i);
  assert.match(oauthRoute, /\/auth\/v1\/authorize/);
  assert.match(oauthRoute, /publicRequestUrl\(request, "\/auth\/callback"\)/);
  assert.doesNotMatch(oauthRoute, /new URL\("\/auth\/callback", request\.url\)/);
  assert.match(oauthRoute, /"email profile"/);
  assert.match(oauthRoute, /"prompt", "select_account"/);
  assert.doesNotMatch(oauthRoute, /callback\.searchParams\.set/);
  assert.match(publicUrl, /APP_BASE_URL/);
  assert.match(publicUrl, /x-forwarded-host/);
  assert.match(publicUrl, /x-forwarded-proto/);
  assert.match(authSession, /AUTH_REQUIRED/);
  assert.match(authSession, /AUTH_SESSION_SECRET/);
  assert.match(authSession, /couponshare_user_v1/);
  assert.match(authSession, /couponshare_browse_v1/);
  assert.doesNotMatch(authSession, /accessConfiguration/);
  assert.match(authServer, /auth\/v1\/user/);
  assert.match(authServer, /getAuthenticatedAccount/);
  assert.match(authServer, /from auth\.users/);
  assert.match(authServer, /where auth_user_id =/);
  assert.match(authServer, /where device_key =/);
  assert.match(statusRoute, /email: account\?\.email/);
  assert.match(statusRoute, /provider: account\?\.provider/);

  assert.match(proxy, /isAccountWrite/);
  assert.match(proxy, /pathname\.startsWith\("\/api\/dunnes"\)/);
  assert.match(proxy, /verifyBrowseAccessToken/);
  assert.match(proxy, /entry_required/);
  assert.match(proxy, /auth_required/);
  assert.doesNotMatch(proxy, /verifyAccessToken\(|pathname === "\/access"|pathname\.startsWith\("\/access/);
  assert.doesNotMatch(admin, /AdminAccessCodeCopy|accessConfiguration/);

  assert.match(dunnesRoute, /authenticatedProfile\(request\)/);
  assert.match(dunnesRoute, /auth_user_id = \$\{session\.authUserId\}::uuid/);
  assert.match(dunnesRoute, /if \(!profile\) return Response\.json\(\{ error: "auth_required" \}/);
  assert.doesNotMatch(dunnesRoute, /const profile = await findOrCreateProfile\(body\.deviceKey\)/);

  assert.match(authControl, /<a className=\{styles\.control\} href=\{loginUrl\}>로그인<\/a>/);
  assert.match(authControl, /<a className=\{styles\.action\} href="\/profile">프로필 설정<\/a>/);
  assert.match(authControl, /현재 로그인 계정/);
  assert.match(authControl, /action="\/api\/auth\/logout"/);
  assert.match(authControlCss, /top: max\(10px, env\(safe-area-inset-top\)\)/);
  assert.match(authControlCss, /\.account/);
  assert.match(authControlCss, /text-overflow: ellipsis/);
  assert.match(issueCss, /position: fixed/);
  assert.match(issueCss, /top: max\(56px/);
  assert.match(issueCss, /z-index: 110/);
  assert.match(guestGuard, /dunnes-upload/);
  assert.match(guestGuard, /dunnes-list-item/);
  assert.match(guestGuard, /window\.location\.assign\(LOGIN_PATH\)/);
  assert.match(dunnesLayout, /DunnesGuestActionGuard/);

  assert.match(migration, /add column if not exists auth_user_id uuid/);
  assert.match(migration, /profiles_auth_user_id_idx/);
});

test("admin infrastructure panel estimates Supabase and Cloud Run capacity", async () => {
  const [panel, tabs, tabCss, layout] = await Promise.all([
    readFile(new URL("../app/admin/AdminInfrastructurePanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminPrimaryTabs.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminPrimaryTabs.css", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/layout.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(panel, /pg_database_size\(current_database\(\)\)/);
  assert.match(panel, /SUPABASE_FREE_DB_BYTES = 500 \* 1024 \* 1024/);
  assert.match(panel, /SUPABASE_FREE_MAU = 50_000/);
  assert.match(panel, /CLOUD_RUN_FREE_REQUESTS = 2_000_000/);
  assert.match(panel, /value >= 85/);
  assert.match(panel, /value >= 70/);
  assert.match(panel, /estimatedDailyActive \* 80 \* 30/);
  assert.match(tabs, /Dashboard/);
  assert.match(tabs, /Users/);
  assert.match(tabs, /Vouchers/);
  assert.match(tabs, /Reports/);
  assert.match(tabs, /Infrastructure/);
  assert.match(tabs, /setAttribute\("data-admin-primary-tab", tab\)/);
  assert.match(tabCss, /data-admin-primary-tab="users"/);
  assert.match(tabCss, /data-admin-primary-tab="infrastructure"/);
  assert.match(layout, /AdminPrimaryTabs/);
  assert.match(layout, /admin-infrastructure-slot/);
});

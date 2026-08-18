import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("supports email password and Google auth with guest-only browsing", async () => {
  const [login, sessionRoute, oauthRoute, authSession, authServer, proxy, migration, admin, authControl, authControlCss, guestGuard, dunnesLayout] = await Promise.all([
    readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/session/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/oauth/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/session.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/server.ts", import.meta.url), "utf8"),
    readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260818070000_auth_profiles.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AuthStatusControl.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AuthStatusControl.module.css", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/DunnesGuestActionGuard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(login, /mode === "login"/);
  assert.match(login, /mode === "signup"/);
  assert.match(login, /confirmPassword/);
  assert.match(login, /password !== confirmPassword/);
  assert.match(login, /GoogleLogo/);
  assert.match(login, /#4285F4/);
  assert.match(login, /continueWithGoogle/);
  assert.match(login, /\/api\/auth\/password/);
  assert.doesNotMatch(login, /Continue with Apple|socialApple/);

  assert.match(sessionRoute, /verifySupabaseAccessToken/);
  assert.match(sessionRoute, /linkAuthenticatedProfile/);
  assert.match(sessionRoute, /HttpOnly; Secure; SameSite=Lax/);

  assert.match(oauthRoute, /provider !== "google"/);
  assert.doesNotMatch(oauthRoute, /apple/i);
  assert.match(oauthRoute, /\/auth\/v1\/authorize/);
  assert.match(authSession, /AUTH_REQUIRED/);
  assert.match(authSession, /AUTH_SESSION_SECRET/);
  assert.match(authSession, /couponshare_user_v1/);
  assert.doesNotMatch(authSession, /accessConfiguration/);
  assert.match(authServer, /auth\/v1\/user/);
  assert.match(authServer, /where auth_user_id =/);
  assert.match(authServer, /where device_key =/);

  assert.match(proxy, /isDunnesWrite/);
  assert.match(proxy, /pathname\.startsWith\("\/api\/dunnes"\)/);
  assert.match(proxy, /method !== "GET"/);
  assert.match(proxy, /auth_required/);
  assert.doesNotMatch(proxy, /verifyAccessToken|ACCESS_COOKIE_NAME|\/access/);
  assert.doesNotMatch(admin, /AdminAccessCodeCopy|accessConfiguration/);

  assert.match(authControl, /window\.location\.assign\(loginUrl\)/);
  assert.match(authControlCss, /top: 76px/);
  assert.match(authControlCss, /top: 64px/);
  assert.match(guestGuard, /dunnes-upload/);
  assert.match(guestGuard, /dunnes-list-item/);
  assert.match(guestGuard, /window\.location\.assign\(LOGIN_PATH\)/);
  assert.match(dunnesLayout, /DunnesGuestActionGuard/);

  assert.match(migration, /add column if not exists auth_user_id uuid/);
  assert.match(migration, /profiles_auth_user_id_idx/);
});

test("admin infrastructure panel estimates Supabase and Cloud Run capacity", async () => {
  const panel = await readFile(new URL("../app/admin/AdminInfrastructurePanel.tsx", import.meta.url), "utf8");
  assert.match(panel, /pg_database_size\(current_database\(\)\)/);
  assert.match(panel, /SUPABASE_FREE_DB_BYTES = 500 \* 1024 \* 1024/);
  assert.match(panel, /SUPABASE_FREE_MAU = 50_000/);
  assert.match(panel, /CLOUD_RUN_FREE_REQUESTS = 2_000_000/);
  assert.match(panel, /value >= 85/);
  assert.match(panel, /value >= 70/);
  assert.match(panel, /estimatedDailyActive \* 80 \* 30/);
});

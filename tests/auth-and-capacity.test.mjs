import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("supports email password and Google auth with legacy profile linking", async () => {
  const [login, sessionRoute, oauthRoute, authSession, authServer, proxy, migration, accessRoute] = await Promise.all([
    readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/session/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/oauth/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/session.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/server.ts", import.meta.url), "utf8"),
    readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260818070000_auth_profiles.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/api/access/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(login, /mode === "login"/);
  assert.match(login, /mode === "signup"/);
  assert.match(login, /이메일로 직접 회원가입/);
  assert.match(login, /Google로 빠른 회원가입/);
  assert.match(login, /continueWithGoogle/);
  assert.doesNotMatch(login, /Apple로 계속|Continue with Apple|social\("apple"\)/);
  assert.match(login, /\/api\/auth\/password/);

  assert.match(sessionRoute, /verifySupabaseAccessToken/);
  assert.match(sessionRoute, /linkAuthenticatedProfile/);
  assert.match(sessionRoute, /HttpOnly; Secure; SameSite=Lax/);

  assert.match(oauthRoute, /provider !== "google"/);
  assert.doesNotMatch(oauthRoute, /apple/);
  assert.match(oauthRoute, /\/auth\/v1\/authorize/);
  assert.match(authSession, /AUTH_REQUIRED/);
  assert.match(authSession, /AUTH_SESSION_SECRET/);
  assert.match(authSession, /couponshare_user_v1/);
  assert.doesNotMatch(authSession, /accessConfiguration/);
  assert.match(authServer, /auth\/v1\/user/);
  assert.match(authServer, /where auth_user_id =/);
  assert.match(authServer, /where device_key =/);

  assert.match(proxy, /verifyUserAuthToken/);
  assert.match(proxy, /auth_required/);
  assert.doesNotMatch(proxy, /verifyAccessToken|ACCESS_COOKIE_NAME|\/access/);
  assert.match(accessRoute, /invite_access_removed/);
  assert.match(accessRoute, /status: 410/);

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
  assert.match(panel, /Cloud Run은 별도 유료 플랜으로 업그레이드하는 구조가 아니라/);
});

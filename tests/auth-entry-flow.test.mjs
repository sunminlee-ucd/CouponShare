import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("requires explicit account or browse entry before app access", async () => {
  const [proxy, session, browseRoute, statusRoute] = await Promise.all([
    readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/session.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/browse/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/status/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(session, /BROWSE_ACCESS_COOKIE_NAME = "couponshare_browse_v1"/);
  assert.match(session, /createBrowseAccessToken/);
  assert.match(session, /verifyBrowseAccessToken/);
  assert.match(browseRoute, /browseAccessCookie/);
  assert.match(proxy, /verifyBrowseAccessToken/);
  assert.match(proxy, /error: "entry_required"/);
  assert.match(proxy, /pathname === "\/profile"/);
  assert.match(proxy, /isAccountWrite/);
  assert.match(statusRoute, /entryMode/);
  assert.match(statusRoute, /browsing/);
});

test("email and Google auth preserve the selected auto-login mode", async () => {
  const [login, passwordRoute, oauthRoute, callback, sessionRoute, preferences, authSession] = await Promise.all([
    readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/password/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/oauth/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/callback/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/session/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/preferences/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/session.ts", import.meta.url), "utf8"),
  ]);

  assert.match(login, /confirmPassword/);
  assert.match(login, /password !== confirmPassword/);
  assert.match(login, /autoLogin/);
  assert.match(login, /GoogleLogo/);
  assert.match(login, /\/api\/auth\/browse/);
  assert.match(login, /provider: "google"/);
  assert.match(passwordRoute, /auth\/v1\/signup/);
  assert.match(passwordRoute, /grant_type=password/);
  assert.match(passwordRoute, /callback\.searchParams\.set\("autoLogin"/);
  assert.match(passwordRoute, /userAuthCookie\(token, autoLogin\)/);
  assert.match(oauthRoute, /callback\.searchParams\.set\("autoLogin"/);
  assert.match(callback, /autoLogin: query\.get\("autoLogin"\) === "1"/);
  assert.match(sessionRoute, /userAuthCookie\(token, autoLogin\)/);
  assert.match(sessionRoute, /clearBrowseAccessCookie/);
  assert.match(preferences, /createUserAuthToken/);
  assert.match(preferences, /userAuthCookie\(refreshedToken, body\.autoLogin\)/);
  assert.match(authSession, /AUTO_LOGIN_COOKIE_NAME = "couponshare_auto_login_v1"/);
  assert.match(authSession, /autoLogin \? `; Max-Age=\$\{SESSION_SECONDS\}` : ""/);
});

test("personal profile settings can toggle auto login", async () => {
  const [profile, control, logout] = await Promise.all([
    readFile(new URL("../app/profile/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AuthStatusControl.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/logout/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(profile, /개인 프로필 설정/);
  assert.match(profile, /\/api\/auth\/preferences/);
  assert.match(profile, /updateAutoLogin/);
  assert.match(control, /프로필 설정/);
  assert.match(control, /window\.location\.assign\("\/profile"\)/);
  assert.match(logout, /clearUserAuthCookie/);
  assert.match(logout, /clearBrowseAccessCookie/);
});

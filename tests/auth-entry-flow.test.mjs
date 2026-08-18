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

test("email and Google auth preserve auto-login without changing the allowed callback URL", async () => {
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
  assert.match(login, /signupSuccess/);
  assert.match(login, /회원가입이 성공적으로 되었습니다\./);
  assert.match(login, /OAUTH_CONTEXT_STORAGE_KEY/);
  assert.match(login, /sessionStorage\.setItem\(OAUTH_CONTEXT_STORAGE_KEY/);
  assert.match(login, /intent: mode/);
  assert.match(login, /GoogleLogo/);
  assert.match(login, /\/api\/auth\/browse/);
  assert.match(login, /\/api\/auth\/oauth\?provider=google/);

  assert.match(passwordRoute, /auth\/v1\/signup/);
  assert.match(passwordRoute, /grant_type=password/);
  assert.match(passwordRoute, /new URL\("\/auth\/callback", request\.url\)/);
  assert.doesNotMatch(passwordRoute, /callback\.searchParams\.set/);
  assert.match(passwordRoute, /userAuthCookie\(token, autoLogin\)/);

  assert.match(oauthRoute, /new URL\("\/auth\/callback", request\.url\)/);
  assert.match(oauthRoute, /authorize\.searchParams\.set\("scopes", "email profile"\)/);
  assert.doesNotMatch(oauthRoute, /callback\.searchParams\.set/);

  assert.match(callback, /readOAuthContext/);
  assert.match(callback, /hash\.get\("access_token"\)/);
  assert.match(callback, /context\.autoLogin/);
  assert.match(callback, /회원가입이 성공적으로 되었습니다\./);
  assert.match(callback, /window\.location\.replace\("\/"\)/);

  assert.match(sessionRoute, /AUTO_LOGIN_COOKIE_NAME/);
  assert.match(sessionRoute, /savedPreference/);
  assert.match(sessionRoute, /userAuthCookie\(token, autoLogin\)/);
  assert.match(sessionRoute, /clearBrowseAccessCookie/);
  assert.match(preferences, /createUserAuthToken/);
  assert.match(preferences, /userAuthCookie\(refreshedToken, body\.autoLogin\)/);
  assert.match(authSession, /AUTO_LOGIN_COOKIE_NAME = "couponshare_auto_login_v1"/);
  assert.match(authSession, /autoLogin \? `; Max-Age=\$\{SESSION_SECONDS\}` : ""/);
});

test("personal profile settings can toggle auto login and logout redirects server-side", async () => {
  const [profile, control, controlCss, logout, issueCss] = await Promise.all([
    readFile(new URL("../app/profile/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AuthStatusControl.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AuthStatusControl.module.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/logout/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/ErrorReportButton.module.css", import.meta.url), "utf8"),
  ]);

  assert.match(profile, /개인 프로필 설정/);
  assert.match(profile, /\/api\/auth\/preferences/);
  assert.match(profile, /updateAutoLogin/);
  assert.match(control, /<a className=\{styles\.action\} href="\/profile">프로필 설정<\/a>/);
  assert.match(control, /<a className=\{styles\.control\} href=\{loginUrl\}>로그인<\/a>/);
  assert.match(control, /action="\/api\/auth\/logout"/);
  assert.match(control, /method="post"/);
  assert.match(controlCss, /top: max\(10px, env\(safe-area-inset-top\)\)/);
  assert.match(controlCss, /top: max\(8px, env\(safe-area-inset-top\)\)/);
  assert.match(issueCss, /margin-right: 184px/);
  assert.match(issueCss, /margin-top: 48px/);
  assert.match(logout, /clearUserAuthCookie/);
  assert.match(logout, /clearBrowseAccessCookie/);
  assert.match(logout, /location: "\/login"/);
  assert.match(logout, /status: 303/);
});

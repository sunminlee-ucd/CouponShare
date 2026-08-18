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
  assert.match(statusRoute, /getAuthenticatedAccount/);
  assert.match(statusRoute, /email: account\?\.email/);
  assert.match(statusRoute, /provider: account\?\.provider/);
});

test("email and Google auth show progress, verify sessions, and complete PKCE login", async () => {
  const [login, passwordRoute, oauthRoute, oauthExchangeRoute, callbackRoute, sessionRoute, preferences, authSession, authServer] = await Promise.all([
    readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/password/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/oauth/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/oauth/exchange/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/callback/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/session/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/preferences/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/session.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/server.ts", import.meta.url), "utf8"),
  ]);

  assert.match(login, /confirmPassword/);
  assert.match(login, /password !== confirmPassword/);
  assert.match(login, /signupSuccess/);
  assert.match(login, /loginSuccess/);
  assert.match(login, /회원가입이 성공적으로 되었습니다\./);
  assert.match(login, /OAUTH_CONTEXT_STORAGE_KEY/);
  assert.match(login, /sessionStorage\.setItem\(OAUTH_CONTEXT_STORAGE_KEY/);
  assert.match(login, /intent: mode/);
  assert.match(login, /GoogleLogo/);
  assert.match(login, /oauthBusy/);
  assert.match(login, /authProgress/);
  assert.match(login, /Google 계정 선택 화면으로 이동 중입니다/);
  assert.match(login, /confirmedAuthStatus/);
  assert.match(login, /status\.authenticated/);
  assert.match(login, /credentials: "same-origin"/);
  assert.match(login, /sessionError/);
  assert.match(login, /setContinueTo\(target\)/);
  assert.match(login, /window\.location\.assign\(target\)/);
  assert.match(login, /invalidCredentials/);
  assert.match(login, /emailNotConfirmed/);
  assert.match(login, /alreadyRegistered/);
  assert.match(login, /\/api\/auth\/browse/);
  assert.match(login, /\/api\/auth\/oauth\?provider=google/);

  assert.match(passwordRoute, /auth\/v1\/signup/);
  assert.match(passwordRoute, /grant_type=password/);
  assert.match(passwordRoute, /publicRequestUrl\(request, "\/auth\/callback"\)/);
  assert.doesNotMatch(passwordRoute, /new URL\("\/auth\/callback", request\.url\)/);
  assert.doesNotMatch(passwordRoute, /callback\.searchParams\.set/);
  assert.match(passwordRoute, /userAuthCookie\(token, autoLogin\)/);

  assert.match(oauthRoute, /publicRequestUrl\(request, "\/auth\/callback"\)/);
  assert.doesNotMatch(oauthRoute, /new URL\("\/auth\/callback", request\.url\)/);
  assert.match(oauthRoute, /randomBytes\(32\)/);
  assert.match(oauthRoute, /createHash\("sha256"\)/);
  assert.doesNotMatch(oauthRoute, /flow_type/);
  assert.match(oauthRoute, /authorize\.searchParams\.set\("code_challenge", codeChallenge\)/);
  assert.match(oauthRoute, /authorize\.searchParams\.set\("code_challenge_method", "s256"\)/);
  assert.match(oauthRoute, /authorize\.searchParams\.set\("scopes", "email profile"\)/);
  assert.match(oauthRoute, /authorize\.searchParams\.set\("prompt", "select_account"\)/);
  assert.match(oauthRoute, /oauthPkceCookie\(codeVerifier\)/);
  assert.match(oauthRoute, /loginErrorRedirect/);
  assert.doesNotMatch(oauthRoute, /callback\.searchParams\.set/);

  assert.match(authSession, /OAUTH_PKCE_COOKIE_NAME = "couponshare_oauth_pkce_v1"/);
  assert.match(authSession, /oauthPkceCookie/);
  assert.match(authSession, /clearOAuthPkceCookie/);
  assert.match(authServer, /auth\/v1\/token\?grant_type=pkce/);
  assert.match(authServer, /auth_code: authCode/);
  assert.match(authServer, /code_verifier: codeVerifier/);

  assert.match(oauthExchangeRoute, /OAUTH_PKCE_COOKIE_NAME/);
  assert.match(oauthExchangeRoute, /exchangeSupabaseAuthCode/);
  assert.match(oauthExchangeRoute, /verifySupabaseAccessToken/);
  assert.match(oauthExchangeRoute, /linkAuthenticatedProfile/);
  assert.match(oauthExchangeRoute, /userAuthCookie\(token, autoLogin\)/);
  assert.match(oauthExchangeRoute, /clearOAuthPkceCookie/);

  assert.doesNotMatch(callbackRoute, /"use client"/);
  assert.match(callbackRoute, /export async function GET\(request: Request\)/);
  assert.match(callbackRoute, /url\.searchParams\.get\("code"\)/);
  assert.match(callbackRoute, /OAUTH_PKCE_COOKIE_NAME/);
  assert.match(callbackRoute, /exchangeSupabaseAuthCode/);
  assert.match(callbackRoute, /verifySupabaseAccessToken/);
  assert.match(callbackRoute, /linkAuthenticatedProfile/);
  assert.match(callbackRoute, /createUserAuthToken/);
  assert.match(callbackRoute, /userAuthCookie\(token, savedPreference\)/);
  assert.match(callbackRoute, /clearOAuthPkceCookie/);
  assert.match(callbackRoute, /meta http-equiv="refresh"/);
  assert.match(callbackRoute, /sessionStorage\.getItem\("couponshare-oauth-context-v1"\)/);
  assert.match(callbackRoute, /회원가입이 성공적으로 되었습니다\./);
  assert.match(callbackRoute, /Google 로그인이 완료되었습니다/);
  assert.match(callbackRoute, /window\.location\.assign\(target\)/);
  assert.match(callbackRoute, /href="\/">CouponShare로 계속하기/);

  assert.match(sessionRoute, /AUTO_LOGIN_COOKIE_NAME/);
  assert.match(sessionRoute, /savedPreference/);
  assert.match(sessionRoute, /userAuthCookie\(token, autoLogin\)/);
  assert.match(sessionRoute, /clearBrowseAccessCookie/);
  assert.match(preferences, /createUserAuthToken/);
  assert.match(preferences, /userAuthCookie\(refreshedToken, body\.autoLogin\)/);
  assert.match(authSession, /AUTO_LOGIN_COOKIE_NAME = "couponshare_auto_login_v1"/);
  assert.match(authSession, /autoLogin \? `; Max-Age=\$\{SESSION_SECONDS\}` : ""/);
});

test("personal profile settings show account identity and keep controls separated", async () => {
  const [profile, control, controlCss, logout, issueCss] = await Promise.all([
    readFile(new URL("../app/profile/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AuthStatusControl.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AuthStatusControl.module.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/logout/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/ErrorReportButton.module.css", import.meta.url), "utf8"),
  ]);

  assert.match(profile, /개인 프로필 설정/);
  assert.match(profile, /현재 로그인 계정/);
  assert.match(profile, /status\.email/);
  assert.match(profile, /status\.provider/);
  assert.match(profile, /\/api\/auth\/preferences/);
  assert.match(profile, /updateAutoLogin/);
  assert.match(profile, /<Link href="\/">메인으로<\/Link>/);
  assert.match(profile, /from "next\/link"/);

  assert.match(control, /현재 로그인 계정/);
  assert.match(control, /status\.email/);
  assert.match(control, /providerLabel/);
  assert.match(control, /<a className=\{styles\.action\} href="\/profile">프로필 설정<\/a>/);
  assert.match(control, /<a className=\{styles\.control\} href=\{loginUrl\}>로그인<\/a>/);
  assert.match(control, /action="\/api\/auth\/logout"/);
  assert.match(control, /method="post"/);
  assert.match(controlCss, /top: max\(10px, env\(safe-area-inset-top\)\)/);
  assert.match(controlCss, /\.account/);
  assert.match(controlCss, /text-overflow: ellipsis/);
  assert.match(controlCss, /max-width: min\(130px, 38vw\)/);
  assert.match(issueCss, /position: fixed/);
  assert.match(issueCss, /top: max\(56px/);
  assert.match(issueCss, /z-index: 110/);

  assert.match(logout, /clearUserAuthCookie/);
  assert.match(logout, /clearBrowseAccessCookie/);
  assert.match(logout, /location: "\/login"/);
  assert.match(logout, /status: 303/);
});

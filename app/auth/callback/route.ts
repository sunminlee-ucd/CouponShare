import {
  AUTO_LOGIN_COOKIE_NAME,
  OAUTH_PKCE_COOKIE_NAME,
  autoLoginPreferenceCookie,
  clearBrowseAccessCookie,
  clearOAuthPkceCookie,
  createUserAuthToken,
  readCookie,
  userAuthCookie,
} from "@/app/auth/session";
import {
  exchangeSupabaseAuthCode,
  linkAuthenticatedProfile,
  verifySupabaseAccessToken,
} from "@/app/auth/server";
import { bindMaintenanceTesterAfterLogin } from "@/app/maintenance-test-access";

export const runtime = "nodejs";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function responseHeaders() {
  return new Headers({
    "cache-control": "private, no-store, max-age=0",
    "content-type": "text/html; charset=utf-8",
  });
}

function errorHtml(message: string) {
  const safeMessage = escapeHtml(message);
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CouponShare 로그인 오류</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5faf6;color:#12372a;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:20px;box-sizing:border-box}
main{width:min(460px,100%);background:#fff;border:1px solid #d7e5dc;border-radius:24px;padding:26px;box-shadow:0 24px 70px rgba(14,55,39,.12)}
h1{font-size:24px;margin:0 0 10px}p{color:#64786d;line-height:1.6}.error{padding:12px 14px;border-radius:12px;background:#fff0ee;color:#9b342c;margin:18px 0;animation:attention 3.2s ease-in-out infinite}a{display:block;text-align:center;padding:13px 16px;border-radius:11px;background:#1c6c49;color:#fff;text-decoration:none;font-weight:800}
@keyframes attention{0%,100%{opacity:1;box-shadow:0 0 0 rgba(156,52,44,0)}50%{opacity:.86;box-shadow:0 0 0 4px rgba(156,52,44,.07)}}
@media(prefers-reduced-motion:reduce){.error{animation:none!important}}
</style>
</head>
<body><main><h1>로그인을 완료하지 못했습니다</h1><p>Google 인증 처리 중 문제가 발생했습니다.</p><div class="error" role="alert">${safeMessage}</div><a href="/login">로그인 화면으로 돌아가기</a></main></body>
</html>`;
}

function successHtml(email: string | null) {
  const safeEmail = escapeHtml(email ?? "Google 계정");
  const emailJson = JSON.stringify(email ?? "Google 계정");
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="5;url=/">
<title>CouponShare 인증 완료</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5faf6;color:#12372a;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:20px;box-sizing:border-box}
main{width:min(460px,100%);background:#fff;border:1px solid #d7e5dc;border-radius:24px;padding:26px;box-shadow:0 24px 70px rgba(14,55,39,.12);text-align:center}
.spinner{width:30px;height:30px;border:3px solid #d8e7dd;border-top-color:#1d704c;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 16px}@keyframes spin{to{transform:rotate(360deg)}}
h1{font-size:24px;margin:0 0 10px}p{color:#64786d;line-height:1.6}.notice{padding:12px 14px;border-radius:12px;background:#edf7f1;color:#296047;margin:18px 0;animation:attention 3.2s ease-in-out infinite}a{display:block;padding:13px 16px;border-radius:11px;background:#1c6c49;color:#fff;text-decoration:none;font-weight:800}
@keyframes attention{0%,100%{opacity:1;box-shadow:0 0 0 rgba(24,108,73,0)}50%{opacity:.86;box-shadow:0 0 0 4px rgba(24,108,73,.06)}}
@media(prefers-reduced-motion:reduce){.notice{animation:none!important}.spinner{animation:none!important}}
</style>
</head>
<body>
<main>
<div class="spinner" aria-hidden="true"></div>
<h1 id="auth-title">Google 로그인이 완료되었습니다</h1>
<p id="auth-message">${safeEmail} 계정으로 로그인되었습니다.</p>
<div class="notice" id="auth-notice" role="status">잠시 후 CouponShare 메인 화면으로 이동합니다.</div>
<a id="continue-link" href="/">CouponShare로 계속하기</a>
</main>
<script>
(async function(){
  var target = "/";
  var intent = "login";
  var autoLogin;
  try {
    var raw = sessionStorage.getItem("couponshare-oauth-context-v1");
    if (raw) {
      var context = JSON.parse(raw);
      if (context && context.intent === "signup") intent = "signup";
      if (context && typeof context.returnTo === "string" && context.returnTo.startsWith("/") && !context.returnTo.startsWith("//")) target = context.returnTo;
      if (context && typeof context.autoLogin === "boolean") autoLogin = context.autoLogin;
    }
    sessionStorage.removeItem("couponshare-oauth-context-v1");
  } catch (_) {}

  var email = ${emailJson};
  var title = document.getElementById("auth-title");
  var message = document.getElementById("auth-message");
  var notice = document.getElementById("auth-notice");
  var link = document.getElementById("continue-link");
  if (intent === "signup") {
    title.textContent = "회원가입이 성공적으로 되었습니다.";
    notice.textContent = "잠시 후 CouponShare 메인 화면으로 이동합니다.";
  }
  message.textContent = email + " 계정으로 인증되었습니다.";
  link.href = target;

  if (typeof autoLogin === "boolean") {
    try {
      await Promise.race([
        fetch("/api/auth/preferences", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ autoLogin: autoLogin })
        }),
        new Promise(function(resolve){ setTimeout(resolve, 800); })
      ]);
    } catch (_) {}
  }

  setTimeout(function(){ window.location.assign(target); }, intent === "signup" ? 1400 : 700);
})();
</script>
</body>
</html>`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cookieHeader = request.headers.get("cookie");
  const headers = responseHeaders();
  headers.append("set-cookie", clearOAuthPkceCookie());

  const authError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (authError) {
    return new Response(errorHtml(authError), { status: 400, headers });
  }

  const code = (url.searchParams.get("code") ?? "").trim();
  const codeVerifier = readCookie(cookieHeader, OAUTH_PKCE_COOKIE_NAME) ?? "";
  if (!code || !codeVerifier) {
    return new Response(errorHtml("Google 인증 정보가 없거나 로그인 시간이 만료되었습니다. 다시 시도해 주세요."), { status: 400, headers });
  }

  const accessToken = await exchangeSupabaseAuthCode(code, codeVerifier);
  if (!accessToken) {
    return new Response(errorHtml("Google 계정은 선택했지만 Supabase 로그인 세션을 만들지 못했습니다. 다시 시도해 주세요."), { status: 401, headers });
  }

  const user = await verifySupabaseAccessToken(accessToken);
  if (!user) {
    return new Response(errorHtml("Google 인증 정보를 확인하지 못했습니다. 다시 로그인해 주세요."), { status: 401, headers });
  }

  const maintenanceTester = await bindMaintenanceTesterAfterLogin(request, user.id, user.email ?? null);
  if (!maintenanceTester.allowed) {
    return new Response(errorHtml("This maintenance login is limited to the test account selected in Admin."), { status: 403, headers });
  }

  try {
    const savedPreference = readCookie(cookieHeader, AUTO_LOGIN_COOKIE_NAME) === "1";
    const profile = await linkAuthenticatedProfile(user.id, "");
    const token = await createUserAuthToken(user.id, profile.profileId);
    headers.append("set-cookie", userAuthCookie(token, savedPreference));
    headers.append("set-cookie", autoLoginPreferenceCookie(savedPreference));
    headers.append("set-cookie", clearBrowseAccessCookie());
    if (maintenanceTester.setCookie) headers.append("set-cookie", maintenanceTester.setCookie);
    return new Response(successHtml(user.email ?? null), { status: 200, headers });
  } catch (error) {
    console.error("Google OAuth callback profile link failed", error);
    return new Response(errorHtml("Google 계정은 확인했지만 CouponShare 프로필 연결에 실패했습니다. 잠시 후 다시 시도해 주세요."), { status: 503, headers });
  }
}

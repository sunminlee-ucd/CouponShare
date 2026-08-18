import {
  AUTO_LOGIN_COOKIE_NAME,
  OAUTH_PKCE_COOKIE_NAME,
  autoLoginPreferenceCookie,
  clearBrowseAccessCookie,
  clearOAuthPkceCookie,
  createUserAuthToken,
  readCookie,
  requestHasSameOrigin,
  userAuthCookie,
} from "@/app/auth/session";
import {
  exchangeSupabaseAuthCode,
  linkAuthenticatedProfile,
  verifySupabaseAccessToken,
} from "@/app/auth/server";

export const runtime = "nodejs";

function jsonWithClearedPkce(body: object, status: number) {
  const headers = new Headers({ "cache-control": "private, no-store" });
  headers.append("set-cookie", clearOAuthPkceCookie());
  return Response.json(body, { status, headers });
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });

  let body: { code?: string; deviceKey?: string; autoLogin?: boolean };
  try {
    body = await request.json() as typeof body;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const code = (body.code ?? "").trim();
  const cookieHeader = request.headers.get("cookie");
  const codeVerifier = readCookie(cookieHeader, OAUTH_PKCE_COOKIE_NAME) ?? "";
  if (!code || !codeVerifier) {
    return jsonWithClearedPkce({ error: "oauth_flow_expired" }, 400);
  }

  const accessToken = await exchangeSupabaseAuthCode(code, codeVerifier);
  if (!accessToken) {
    return jsonWithClearedPkce({ error: "oauth_code_exchange_failed" }, 401);
  }

  const user = await verifySupabaseAccessToken(accessToken);
  if (!user) {
    return jsonWithClearedPkce({ error: "invalid_auth_token" }, 401);
  }

  try {
    const savedPreference = readCookie(cookieHeader, AUTO_LOGIN_COOKIE_NAME) === "1";
    const autoLogin = typeof body.autoLogin === "boolean" ? body.autoLogin : savedPreference;
    const profile = await linkAuthenticatedProfile(user.id, body.deviceKey ?? "");
    const token = await createUserAuthToken(user.id, profile.profileId);
    const headers = new Headers({ "cache-control": "private, no-store" });
    headers.append("set-cookie", userAuthCookie(token, autoLogin));
    headers.append("set-cookie", autoLoginPreferenceCookie(autoLogin));
    headers.append("set-cookie", clearBrowseAccessCookie());
    headers.append("set-cookie", clearOAuthPkceCookie());
    return Response.json({
      ok: true,
      deviceKey: profile.deviceKey,
      email: user.email ?? null,
      provider: user.app_metadata?.provider ?? "google",
    }, { headers });
  } catch (error) {
    console.error("Google OAuth profile link failed", error);
    return jsonWithClearedPkce({ error: "profile_link_failed" }, 503);
  }
}

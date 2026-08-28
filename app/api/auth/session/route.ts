import {
  AUTO_LOGIN_COOKIE_NAME,
  autoLoginPreferenceCookie,
  clearBrowseAccessCookie,
  createUserAuthToken,
  readCookie,
  requestHasSameOrigin,
  userAuthCookie,
} from "@/app/auth/session";
import { linkAuthenticatedProfile, verifySupabaseAccessToken } from "@/app/auth/server";
import { bindMaintenanceTesterAfterLogin } from "@/app/maintenance-test-access";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  let body: { accessToken?: string; deviceKey?: string; autoLogin?: boolean };
  try {
    body = await request.json() as typeof body;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const user = await verifySupabaseAccessToken(body.accessToken ?? "");
  if (!user) return Response.json({ error: "invalid_auth_token" }, { status: 401 });

  const maintenanceTester = await bindMaintenanceTesterAfterLogin(request, user.id, user.email ?? null);
  if (!maintenanceTester.allowed) {
    return Response.json({ error: "maintenance_test_account_required" }, { status: 403 });
  }

  try {
    const savedPreference = readCookie(request.headers.get("cookie"), AUTO_LOGIN_COOKIE_NAME) === "1";
    const autoLogin = typeof body.autoLogin === "boolean" ? body.autoLogin : savedPreference;
    const profile = await linkAuthenticatedProfile(user.id, body.deviceKey ?? "");
    const token = await createUserAuthToken(user.id, profile.profileId);
    const headers = new Headers({ "cache-control": "private, no-store" });
    headers.append("set-cookie", userAuthCookie(token, autoLogin));
    headers.append("set-cookie", autoLoginPreferenceCookie(autoLogin));
    headers.append("set-cookie", clearBrowseAccessCookie());
    if (maintenanceTester.setCookie) headers.append("set-cookie", maintenanceTester.setCookie);
    return Response.json({ ok: true, deviceKey: profile.deviceKey, email: user.email ?? null }, { headers });
  } catch (error) {
    console.error("Auth profile link failed", error);
    return Response.json({ error: "profile_link_failed" }, { status: 503 });
  }
}

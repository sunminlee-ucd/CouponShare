import {
  autoLoginPreferenceCookie,
  authConfiguration,
  clearBrowseAccessCookie,
  createUserAuthToken,
  requestHasSameOrigin,
  userAuthCookie,
} from "@/app/auth/session";
import { publicRequestUrl } from "@/app/auth/public-url";
import { linkAuthenticatedProfile, verifySupabaseAccessToken } from "@/app/auth/server";
import { bindMaintenanceTesterAfterLogin } from "@/app/maintenance-test-access";
import { readMaintenanceMode } from "@/app/maintenance-mode";

export const runtime = "nodejs";

function safeReturnTo(value: unknown) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const configuration = await authConfiguration();
  if (!configuration.configured) return Response.json({ error: "auth_not_configured" }, { status: 503 });

  let body: { mode?: "login" | "signup"; email?: string; password?: string; deviceKey?: string; returnTo?: string; autoLogin?: boolean };
  try {
    body = await request.json() as typeof body;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length > 128) {
    return Response.json({ error: "invalid_credentials" }, { status: 400 });
  }

  const mode = body.mode === "signup" ? "signup" : "login";
  if (mode === "signup" && await readMaintenanceMode()) {
    return Response.json({ error: "maintenance_signup_disabled" }, { status: 403 });
  }

  const autoLogin = body.autoLogin === true;
  const returnTo = safeReturnTo(body.returnTo);
  // Always build confirmation redirects from the public proxy-aware origin.
  const callback = publicRequestUrl(request, "/auth/callback");
  const endpoint = mode === "signup"
    ? `${configuration.url}/auth/v1/signup?redirect_to=${encodeURIComponent(callback.toString())}`
    : `${configuration.url}/auth/v1/token?grant_type=password`;

  let authResponse: Response;
  try {
    authResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: configuration.publishableKey,
        authorization: `Bearer ${configuration.publishableKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
  } catch {
    return Response.json({ error: "auth_unavailable" }, { status: 503 });
  }

  const authResult = await authResponse.json().catch(() => ({})) as {
    access_token?: string;
    error?: string;
    error_description?: string;
    msg?: string;
    message?: string;
  };
  if (!authResponse.ok) {
    const message = authResult.error_description ?? authResult.msg ?? authResult.message ?? authResult.error ?? "auth_failed";
    return Response.json({ error: "auth_failed", message }, { status: authResponse.status >= 500 ? 503 : 400 });
  }

  if (!authResult.access_token) {
    const headers = new Headers({ "cache-control": "no-store" });
    headers.append("set-cookie", autoLoginPreferenceCookie(autoLogin));
    return Response.json({ ok: true, confirmationRequired: true }, { headers });
  }

  const user = await verifySupabaseAccessToken(authResult.access_token);
  if (!user) return Response.json({ error: "auth_failed" }, { status: 401 });

  const maintenanceTester = await bindMaintenanceTesterAfterLogin(request, user.id, user.email ?? email);
  if (!maintenanceTester.allowed) {
    return Response.json({ error: "maintenance_test_account_required" }, { status: 403 });
  }

  try {
    const profile = await linkAuthenticatedProfile(user.id, body.deviceKey ?? "");
    const token = await createUserAuthToken(user.id, profile.profileId);
    const headers = new Headers({ "cache-control": "private, no-store" });
    headers.append("set-cookie", userAuthCookie(token, autoLogin));
    headers.append("set-cookie", autoLoginPreferenceCookie(autoLogin));
    headers.append("set-cookie", clearBrowseAccessCookie());
    if (maintenanceTester.setCookie) headers.append("set-cookie", maintenanceTester.setCookie);
    return Response.json({ ok: true, deviceKey: profile.deviceKey, email: user.email ?? email, returnTo }, { headers });
  } catch (error) {
    console.error("Password auth profile link failed", error);
    return Response.json({ error: "profile_link_failed" }, { status: 503 });
  }
}

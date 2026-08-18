import { authConfiguration, createUserAuthToken, USER_AUTH_COOKIE_NAME } from "@/app/auth/session";
import { linkAuthenticatedProfile, verifySupabaseAccessToken } from "@/app/auth/server";

export const runtime = "nodejs";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

function safeReturnTo(value: unknown) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const configuration = await authConfiguration();
  if (!configuration.configured) return Response.json({ error: "auth_not_configured" }, { status: 503 });

  let body: { mode?: "login" | "signup"; email?: string; password?: string; deviceKey?: string; returnTo?: string };
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
  const returnTo = safeReturnTo(body.returnTo);
  const callback = new URL("/auth/callback", request.url);
  callback.searchParams.set("returnTo", returnTo);
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
    return Response.json({ ok: true, confirmationRequired: true }, { headers: { "cache-control": "no-store" } });
  }

  const user = await verifySupabaseAccessToken(authResult.access_token);
  if (!user) return Response.json({ error: "auth_failed" }, { status: 401 });

  try {
    const profile = await linkAuthenticatedProfile(user.id, body.deviceKey ?? "");
    const token = await createUserAuthToken(user.id, profile.profileId);
    return Response.json({ ok: true, deviceKey: profile.deviceKey, email: user.email ?? email, returnTo }, {
      headers: {
        "cache-control": "private, no-store",
        "set-cookie": `${USER_AUTH_COOKIE_NAME}=${token}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`,
      },
    });
  } catch (error) {
    console.error("Password auth profile link failed", error);
    return Response.json({ error: "profile_link_failed" }, { status: 503 });
  }
}

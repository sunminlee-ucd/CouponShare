import {
  autoLoginPreferenceCookie,
  clearBrowseAccessCookie,
  createUserAuthToken,
  userAuthCookie,
} from "@/app/auth/session";
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

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  let body: { accessToken?: string; deviceKey?: string; autoLogin?: boolean };
  try {
    body = await request.json() as typeof body;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const user = await verifySupabaseAccessToken(body.accessToken ?? "");
  if (!user) return Response.json({ error: "invalid_auth_token" }, { status: 401 });

  try {
    const autoLogin = body.autoLogin === true;
    const profile = await linkAuthenticatedProfile(user.id, body.deviceKey ?? "");
    const token = await createUserAuthToken(user.id, profile.profileId);
    const headers = new Headers({ "cache-control": "private, no-store" });
    headers.append("set-cookie", userAuthCookie(token, autoLogin));
    headers.append("set-cookie", autoLoginPreferenceCookie(autoLogin));
    headers.append("set-cookie", clearBrowseAccessCookie());
    return Response.json({ ok: true, deviceKey: profile.deviceKey, email: user.email ?? null }, { headers });
  } catch (error) {
    console.error("Auth profile link failed", error);
    return Response.json({ error: "profile_link_failed" }, { status: 503 });
  }
}

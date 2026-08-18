import {
  autoLoginPreferenceCookie,
  createUserAuthToken,
  readCookie,
  USER_AUTH_COOKIE_NAME,
  userAuthCookie,
  verifyUserAuthToken,
} from "@/app/auth/session";

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
  const currentToken = readCookie(request.headers.get("cookie"), USER_AUTH_COOKIE_NAME);
  const session = await verifyUserAuthToken(currentToken);
  if (!session) return Response.json({ error: "auth_required" }, { status: 401 });

  let body: { autoLogin?: boolean };
  try {
    body = await request.json() as typeof body;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  if (typeof body.autoLogin !== "boolean") return Response.json({ error: "invalid_request" }, { status: 400 });

  const refreshedToken = await createUserAuthToken(session.authUserId, session.profileId);
  const headers = new Headers({ "cache-control": "private, no-store" });
  headers.append("set-cookie", userAuthCookie(refreshedToken, body.autoLogin));
  headers.append("set-cookie", autoLoginPreferenceCookie(body.autoLogin));
  return Response.json({ ok: true, autoLogin: body.autoLogin }, { headers });
}

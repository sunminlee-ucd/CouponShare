import { authConfiguration, readCookie, USER_AUTH_COOKIE_NAME, verifyUserAuthToken } from "@/app/auth/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const configuration = await authConfiguration();
  const token = readCookie(request.headers.get("cookie"), USER_AUTH_COOKIE_NAME);
  const session = configuration.configured ? await verifyUserAuthToken(token) : null;
  return Response.json({
    configured: configuration.configured,
    required: configuration.required,
    authenticated: Boolean(session),
  }, { headers: { "cache-control": "private, no-store" } });
}

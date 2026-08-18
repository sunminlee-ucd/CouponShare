import {
  AUTO_LOGIN_COOKIE_NAME,
  authConfiguration,
  BROWSE_ACCESS_COOKIE_NAME,
  readCookie,
  USER_AUTH_COOKIE_NAME,
  verifyBrowseAccessToken,
  verifyUserAuthToken,
} from "@/app/auth/session";
import { getAuthenticatedAccount } from "@/app/auth/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const configuration = await authConfiguration();
  const cookieHeader = request.headers.get("cookie");
  const token = readCookie(cookieHeader, USER_AUTH_COOKIE_NAME);
  const browseToken = readCookie(cookieHeader, BROWSE_ACCESS_COOKIE_NAME);
  const session = configuration.configured ? await verifyUserAuthToken(token) : null;
  const browsing = configuration.configured && !session ? await verifyBrowseAccessToken(browseToken) : false;
  const account = session ? await getAuthenticatedAccount(session.authUserId) : null;

  return Response.json({
    configured: configuration.configured,
    required: configuration.required,
    authenticated: Boolean(session),
    browsing,
    entryMode: session ? "account" : browsing ? "browse" : "none",
    autoLogin: readCookie(cookieHeader, AUTO_LOGIN_COOKIE_NAME) === "1",
    email: account?.email ?? null,
    provider: account?.provider ?? null,
  }, { headers: { "cache-control": "private, no-store" } });
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  authConfiguration,
  BROWSE_ACCESS_COOKIE_NAME,
  USER_AUTH_COOKIE_NAME,
  verifyBrowseAccessToken,
  verifyUserAuthToken,
} from "@/app/auth/session";

function hardened<T extends Response>(response: T): T {
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("x-frame-options", "DENY");
  response.headers.set("referrer-policy", "no-referrer");
  response.headers.set("permissions-policy", "camera=(self), microphone=(), geolocation=()");
  return response;
}

function publicPath(pathname: string) {
  return pathname === "/privacy"
    || pathname === "/terms"
    || pathname === "/login"
    || pathname.startsWith("/auth/callback")
    || pathname.startsWith("/api/auth/")
    || pathname.startsWith("/_next/")
    || pathname.startsWith("/couponshare-")
    || pathname.startsWith("/icon-")
    || pathname.startsWith("/maskable-")
    || pathname === "/favicon.ico"
    || pathname === "/favicon.svg"
    || pathname === "/og.png"
    || pathname.startsWith("/manifest");
}

function isReadOnlyMethod(request: NextRequest) {
  const method = request.method.toUpperCase();
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}

function isAccountWrite(request: NextRequest) {
  if (isReadOnlyMethod(request)) return false;
  const pathname = request.nextUrl.pathname;
  return pathname.startsWith("/api/dunnes") || pathname.startsWith("/api/coupon-wallet");
}

function loginRedirect(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return hardened(NextResponse.redirect(loginUrl));
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/");

  if (isAdmin || publicPath(pathname)) return hardened(NextResponse.next());

  const auth = await authConfiguration();
  if (!auth.configured) return hardened(new NextResponse("User authentication is not configured.", { status: 503 }));

  const session = await verifyUserAuthToken(request.cookies.get(USER_AUTH_COOKIE_NAME)?.value);
  const browsing = !session && await verifyBrowseAccessToken(request.cookies.get(BROWSE_ACCESS_COOKIE_NAME)?.value);

  if (pathname === "/profile" || pathname.startsWith("/profile/")) {
    if (!session) return loginRedirect(request);
    return hardened(NextResponse.next());
  }

  // Browse mode is read-only. Any Dunnes or coupon-wallet mutation requires a real account.
  if (isAccountWrite(request) && !session) {
    return hardened(Response.json({ error: "auth_required" }, { status: 401 }));
  }

  if (auth.required && !session) {
    if (pathname.startsWith("/api/")) return hardened(Response.json({ error: "auth_required" }, { status: 401 }));
    return loginRedirect(request);
  }

  // A fresh browser cannot enter the application just by typing the production URL.
  // The user must either authenticate or explicitly choose Browse on /login.
  if (!session && !browsing) {
    if (pathname.startsWith("/api/")) return hardened(Response.json({ error: "entry_required" }, { status: 401 }));
    return loginRedirect(request);
  }

  return hardened(NextResponse.next());
}

export const config = {
  matcher: ["/:path*"],
};

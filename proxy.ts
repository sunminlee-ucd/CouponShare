import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_COOKIE_NAME, accessConfiguration, verifyAccessToken } from "@/app/access/session";
import { authConfiguration, USER_AUTH_COOKIE_NAME, verifyUserAuthToken } from "@/app/auth/session";

function hardened<T extends Response>(response: T): T {
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("x-frame-options", "DENY");
  response.headers.set("referrer-policy", "no-referrer");
  response.headers.set("permissions-policy", "camera=(self), microphone=(), geolocation=()");
  return response;
}

function publicPath(pathname: string) {
  return pathname === "/access"
    || pathname === "/privacy"
    || pathname === "/terms"
    || pathname === "/api/access"
    || pathname.startsWith("/_next/")
    || pathname.startsWith("/couponshare-")
    || pathname.startsWith("/icon-")
    || pathname.startsWith("/maskable-")
    || pathname === "/favicon.ico"
    || pathname === "/favicon.svg"
    || pathname === "/og.png"
    || pathname.startsWith("/manifest");
}

function authExemptPath(pathname: string) {
  return pathname === "/login"
    || pathname.startsWith("/auth/callback")
    || pathname.startsWith("/api/auth/");
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/");

  if (isAdmin) return hardened(NextResponse.next());

  if (!publicPath(pathname)) {
    const configuration = await accessConfiguration();
    if (!configuration.configured) {
      return hardened(new NextResponse("Private access is not configured.", { status: 503 }));
    }
    const validSession = await verifyAccessToken(request.cookies.get(ACCESS_COOKIE_NAME)?.value, configuration.sessionSecret);
    if (!validSession) {
      if (pathname.startsWith("/api/")) return hardened(Response.json({ error: "access_required" }, { status: 401 }));
      const accessUrl = new URL("/access", request.url);
      accessUrl.searchParams.set("returnTo", `${pathname}${request.nextUrl.search}`);
      return hardened(NextResponse.redirect(accessUrl));
    }
  }

  if (!publicPath(pathname) && !authExemptPath(pathname)) {
    const auth = await authConfiguration();
    if (auth.required) {
      if (!auth.configured) return hardened(new NextResponse("User authentication is not configured.", { status: 503 }));
      const session = await verifyUserAuthToken(request.cookies.get(USER_AUTH_COOKIE_NAME)?.value);
      if (!session) {
        if (pathname.startsWith("/api/")) return hardened(Response.json({ error: "auth_required" }, { status: 401 }));
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("returnTo", `${pathname}${request.nextUrl.search}`);
        return hardened(NextResponse.redirect(loginUrl));
      }
    }
  }

  return hardened(NextResponse.next());
}

export const config = {
  matcher: ["/:path*"],
};

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_COOKIE_NAME, accessConfiguration, verifyAccessToken } from "@/app/access/session";
import { ADMIN_COOKIE_NAME, ADMIN_SESSION_MAX_AGE, createAdminToken, verifyAdminToken } from "@/app/admin/session";

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

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/");
  const isAdminLogin = pathname === "/admin/login" || pathname === "/api/admin/login";

  if (!isAdmin && !publicPath(pathname)) {
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

  if (!isAdmin) return hardened(NextResponse.next());

  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 16) {
    return hardened(new NextResponse("ADMIN_PASSWORD is not configured securely.", {
      status: 503,
      headers: { "cache-control": "private, no-store, max-age=0" },
    }));
  }

  if (isAdminLogin) return hardened(NextResponse.next());
  const validAdminSession = await verifyAdminToken(request.cookies.get(ADMIN_COOKIE_NAME)?.value, password);
  if (!validAdminSession) {
    if (pathname.startsWith("/api/admin/")) return hardened(Response.json({ error: "admin_login_required" }, { status: 401 }));
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("returnTo", `${pathname}${request.nextUrl.search}`);
    return hardened(NextResponse.redirect(loginUrl));
  }
  const response = NextResponse.next();
  response.cookies.set(ADMIN_COOKIE_NAME, await createAdminToken(password), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: ADMIN_SESSION_MAX_AGE,
    path: "/",
  });
  return hardened(response);
}

export const config = {
  matcher: ["/:path*"],
};

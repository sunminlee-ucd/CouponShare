import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authConfiguration, USER_AUTH_COOKIE_NAME, verifyUserAuthToken } from "@/app/auth/session";

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

function isDunnesWrite(request: NextRequest) {
  const method = request.method.toUpperCase();
  return request.nextUrl.pathname.startsWith("/api/dunnes")
    && method !== "GET"
    && method !== "HEAD"
    && method !== "OPTIONS";
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/");

  if (isAdmin || publicPath(pathname)) return hardened(NextResponse.next());

  const auth = await authConfiguration();
  const session = auth.configured
    ? await verifyUserAuthToken(request.cookies.get(USER_AUTH_COOKIE_NAME)?.value)
    : null;

  // Guests may browse Dunnes voucher lists, but every Dunnes mutation/reveal request
  // requires a real CouponShare account regardless of AUTH_REQUIRED.
  if (isDunnesWrite(request)) {
    if (!auth.configured) return hardened(new NextResponse("User authentication is not configured.", { status: 503 }));
    if (!session) return hardened(Response.json({ error: "auth_required" }, { status: 401 }));
  }

  if (auth.required && !session) {
    if (!auth.configured) return hardened(new NextResponse("User authentication is not configured.", { status: 503 }));
    if (pathname.startsWith("/api/")) return hardened(Response.json({ error: "auth_required" }, { status: 401 }));
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnTo", `${pathname}${request.nextUrl.search}`);
    return hardened(NextResponse.redirect(loginUrl));
  }

  return hardened(NextResponse.next());
}

export const config = {
  matcher: ["/:path*"],
};

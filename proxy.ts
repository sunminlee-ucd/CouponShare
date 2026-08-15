import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_COOKIE_NAME, accessConfiguration, verifyAccessToken } from "@/app/access/session";

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

  if (isAdmin) return hardened(NextResponse.next());

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

  return hardened(NextResponse.next());
}

export const config = {
  matcher: ["/:path*"],
};

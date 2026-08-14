import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_COOKIE_NAME, accessConfiguration, secureTextEqual, verifyAccessToken } from "@/app/access/session";

const failedAdminAttempts = new Map<string, { count: number; resetAt: number }>();

function hardened<T extends Response>(response: T): T {
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("x-frame-options", "DENY");
  response.headers.set("referrer-policy", "no-referrer");
  response.headers.set("permissions-policy", "camera=(self), microphone=(), geolocation=()");
  return response;
}

function unauthorized(message = "Admin authentication required") {
  return hardened(new NextResponse(message, {
    status: 401,
    headers: {
      "www-authenticate": 'Basic realm="CouponShare Admin", charset="UTF-8"',
      "cache-control": "private, no-store, max-age=0",
    },
  }));
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

function requestAddress(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/");

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

  const address = requestAddress(request);
  const now = Date.now();
  const attempt = failedAdminAttempts.get(address);
  if (attempt && attempt.resetAt > now && attempt.count >= 5) {
    return hardened(new NextResponse("Too many attempts", { status: 429, headers: { "retry-after": String(Math.ceil((attempt.resetAt - now) / 1000)) } }));
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) return unauthorized();

  try {
    const decoded = atob(authorization.slice(6));
    const separator = decoded.indexOf(":");
    const username = decoded.slice(0, separator);
    const suppliedPassword = decoded.slice(separator + 1);
    if (separator < 0 || username !== "admin" || !await secureTextEqual(suppliedPassword, password)) {
      const current = attempt && attempt.resetAt > now ? attempt : { count: 0, resetAt: now + 15 * 60 * 1000 };
      failedAdminAttempts.set(address, { ...current, count: current.count + 1 });
      return unauthorized("Invalid admin credentials");
    }
  } catch {
    return unauthorized("Invalid admin credentials");
  }

  failedAdminAttempts.delete(address);
  return hardened(NextResponse.next());
}

export const config = {
  matcher: ["/:path*"],
};

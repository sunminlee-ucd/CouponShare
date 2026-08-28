import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  authConfiguration,
  BROWSE_ACCESS_COOKIE_NAME,
  USER_AUTH_COOKIE_NAME,
  verifyBrowseAccessToken,
  verifyUserAuthToken,
} from "@/app/auth/session";
import { LIDL_ENABLED } from "@/app/features";
import {
  MAINTENANCE_TEST_COOKIE_NAME,
  verifyMaintenanceTestToken,
} from "@/app/maintenance-test-access";
import { readMaintenanceMode } from "@/app/maintenance-mode";

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

function maintenanceBypassPath(pathname: string) {
  return pathname === "/maintenance"
    || pathname === "/api/maintenance-status"
    || pathname === "/privacy"
    || pathname === "/terms"
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
  return pathname.startsWith("/api/dunnes")
    || pathname.startsWith("/api/notifications")
    || pathname.startsWith("/api/coupon-wallet")
    || pathname === "/api/error-reports"
    || pathname === "/api/account";
}

function loginRedirect(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return hardened(NextResponse.redirect(loginUrl));
}

function maintenanceResponse(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const response = Response.json({ error: "maintenance" }, { status: 503 });
    response.headers.set("retry-after", "10");
    response.headers.set("cache-control", "no-store");
    return hardened(response);
  }

  const target = new URL("/maintenance", request.url);
  return hardened(NextResponse.redirect(target));
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/");

  if (isAdmin || maintenanceBypassPath(pathname)) return hardened(NextResponse.next());

  let maintenanceTesterSession: Awaited<ReturnType<typeof verifyUserAuthToken>> = null;
  if (await readMaintenanceMode()) {
    const testerGrant = await verifyMaintenanceTestToken(request.cookies.get(MAINTENANCE_TEST_COOKIE_NAME)?.value);
    if (!testerGrant) return maintenanceResponse(request);

    maintenanceTesterSession = await verifyUserAuthToken(request.cookies.get(USER_AUTH_COOKIE_NAME)?.value);
    if (!maintenanceTesterSession || maintenanceTesterSession.authUserId !== testerGrant.authUserId) {
      return maintenanceResponse(request);
    }
  }

  if (publicPath(pathname)) return hardened(NextResponse.next());

  if (!LIDL_ENABLED && pathname.startsWith("/api/coupon-wallet")) {
    return hardened(Response.json({ error: "feature_disabled" }, { status: 404 }));
  }

  const auth = await authConfiguration();
  if (!auth.configured) return hardened(new NextResponse("User authentication is not configured.", { status: 503 }));

  const session = maintenanceTesterSession ?? await verifyUserAuthToken(request.cookies.get(USER_AUTH_COOKIE_NAME)?.value);
  const browsing = !session && await verifyBrowseAccessToken(request.cookies.get(BROWSE_ACCESS_COOKIE_NAME)?.value);

  if (pathname === "/profile" || pathname.startsWith("/profile/") || pathname === "/settings" || pathname.startsWith("/settings/")) {
    if (!session) return loginRedirect(request);
    return hardened(NextResponse.next());
  }

  if (pathname === "/api/account" && !session) {
    return hardened(Response.json({ error: "auth_required" }, { status: 401 }));
  }

  if (isAccountWrite(request) && !session) {
    return hardened(Response.json({ error: "auth_required" }, { status: 401 }));
  }

  if (auth.required && !session) {
    if (pathname.startsWith("/api/")) return hardened(Response.json({ error: "auth_required" }, { status: 401 }));
    return loginRedirect(request);
  }

  if (!session && !browsing) {
    if (pathname.startsWith("/api/")) return hardened(Response.json({ error: "entry_required" }, { status: 401 }));
    return loginRedirect(request);
  }

  if (pathname === "/api/dunnes-vouchers" && request.method.toUpperCase() === "GET") {
    const target = request.nextUrl.clone();
    target.pathname = "/api/dunnes-state";
    return hardened(NextResponse.rewrite(target));
  }

  return hardened(NextResponse.next());
}

export const config = {
  matcher: ["/:path*"],
};

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

function maintenanceAuthPath(pathname: string) {
  return pathname === "/login"
    || pathname.startsWith("/auth/callback")
    || pathname.startsWith("/api/auth/");
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

    if (testerGrant?.authUserId) {
      maintenanceTesterSession = await verifyUserAuthToken(request.cookies.get(USER_AUTH_COOKIE_NAME)?.value);
      if (!maintenanceTesterSession || maintenanceTesterSession.authUserId !== testerGrant.authUserId) {
        return maintenanceResponse(request);
      }
    } else if (testerGrant && maintenanceAuthPath(pathname)) {
      return hardened(NextResponse.next());
    } else {
      return maintenanceResponse(request);
    }
  }

  if (publicPath(pathname)) return hardened(NextResponse.next());

  // Lidl remains in the repository as a feature-flagged showcase, but its API surface is closed in production.
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

  // Personal data export/deletion always requires a real account, including GET requests.
  if (pathname === "/api/account" && !session) {
    return hardened(Response.json({ error: "auth_required" }, { status: 401 }));
  }

  // Browse mode is strictly read-only. Dunnes mutations, reports, private notifications, account changes and hidden Lidl writes require a real account.
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

  // All Dunnes reads use the account-aware state endpoint. Browse reads never create a profile row.
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

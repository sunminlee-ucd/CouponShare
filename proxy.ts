import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function unauthorized(message = "Admin authentication required") {
  return new NextResponse(message, {
    status: 401,
    headers: {
      "www-authenticate": 'Basic realm="CouponShare Admin", charset="UTF-8"',
      "cache-control": "private, no-store, max-age=0",
    },
  });
}

export function proxy(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 16) {
    return new NextResponse("ADMIN_PASSWORD is not configured securely.", {
      status: 503,
      headers: { "cache-control": "private, no-store, max-age=0" },
    });
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) return unauthorized();

  try {
    const decoded = atob(authorization.slice(6));
    const separator = decoded.indexOf(":");
    const username = decoded.slice(0, separator);
    const suppliedPassword = decoded.slice(separator + 1);
    if (separator < 0 || username !== "admin" || suppliedPassword !== password) {
      return unauthorized("Invalid admin credentials");
    }
  } catch {
    return unauthorized("Invalid admin credentials");
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

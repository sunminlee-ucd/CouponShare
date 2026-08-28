import {
  clearBrowseAccessCookie,
  clearOAuthPkceCookie,
  clearUserAuthCookie,
  requestHasSameOrigin,
} from "@/app/auth/session";
import { clearMaintenanceTestCookie } from "@/app/maintenance-test-access";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });

  const headers = new Headers({
    "cache-control": "no-store",
    location: "/login",
  });
  headers.append("set-cookie", clearUserAuthCookie());
  headers.append("set-cookie", clearBrowseAccessCookie());
  headers.append("set-cookie", clearOAuthPkceCookie());
  headers.append("set-cookie", clearMaintenanceTestCookie());

  return new Response(null, { status: 303, headers });
}

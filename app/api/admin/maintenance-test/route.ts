import {
  ADMIN_COOKIE_NAME,
  readCookie,
  requestHasSameOrigin,
  verifyAdminToken,
} from "@/app/admin/session";
import {
  clearBrowseAccessCookie,
  clearOAuthPkceCookie,
  clearUserAuthCookie,
} from "@/app/auth/session";
import {
  createMaintenanceTestToken,
  isMaintenanceTestEmail,
  maintenanceTestCookie,
} from "@/app/maintenance-test-access";
import { readMaintenanceMode } from "@/app/maintenance-mode";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const password = process.env.ADMIN_PASSWORD ?? "";
  const adminToken = readCookie(request.headers.get("cookie"), ADMIN_COOKIE_NAME);
  if (!await verifyAdminToken(adminToken, password)) return Response.json({ error: "admin_required" }, { status: 401 });
  if (!await readMaintenanceMode({ fresh: true })) {
    return Response.json({ error: "maintenance_required" }, { status: 409 });
  }

  let body: { email?: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!isMaintenanceTestEmail(email)) return Response.json({ error: "tester_not_allowed" }, { status: 403 });

  const token = await createMaintenanceTestToken(email, null);
  const headers = new Headers({ "cache-control": "private, no-store" });
  headers.append("set-cookie", maintenanceTestCookie(token, false));
  headers.append("set-cookie", clearUserAuthCookie());
  headers.append("set-cookie", clearBrowseAccessCookie());
  headers.append("set-cookie", clearOAuthPkceCookie());

  const loginUrl = `/login?maintenanceTest=1&testEmail=${encodeURIComponent(email)}`;
  return Response.json({ ok: true, loginUrl, email }, { headers });
}

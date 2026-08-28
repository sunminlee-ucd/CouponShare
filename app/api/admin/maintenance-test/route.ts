import {
  ADMIN_COOKIE_NAME,
  readCookie,
  requestHasSameOrigin,
  verifyAdminToken,
} from "@/app/admin/session";
import {
  clearBrowseAccessCookie,
  clearOAuthPkceCookie,
  createUserAuthToken,
  userAuthCookie,
} from "@/app/auth/session";
import { linkAuthenticatedProfile } from "@/app/auth/server";
import {
  createMaintenanceTestToken,
  isMaintenanceTestEmail,
  maintenanceTestCookie,
} from "@/app/maintenance-test-access";
import { readMaintenanceMode } from "@/app/maintenance-mode";
import { getSqlClient } from "@/db";

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

  try {
    const sql = getSqlClient();
    const [account] = await sql<{ id: string; email: string | null }[]>`
      select id::text, email
      from auth.users
      where lower(email) = ${email}
      limit 1
    `;
    if (!account?.id) return Response.json({ error: "tester_account_not_found" }, { status: 404 });

    const profile = await linkAuthenticatedProfile(account.id, "");
    const userToken = await createUserAuthToken(account.id, profile.profileId);
    const testerToken = await createMaintenanceTestToken(email, account.id);
    const headers = new Headers({ "cache-control": "private, no-store" });
    headers.append("set-cookie", userAuthCookie(userToken, false));
    headers.append("set-cookie", maintenanceTestCookie(testerToken));
    headers.append("set-cookie", clearBrowseAccessCookie());
    headers.append("set-cookie", clearOAuthPkceCookie());

    return Response.json({ ok: true, appUrl: "/", email }, { headers });
  } catch (error) {
    console.error("Maintenance tester session creation failed", error);
    return Response.json({ error: "tester_session_failed" }, { status: 503 });
  }
}

import { ADMIN_COOKIE_NAME, readCookie, requestHasSameOrigin, verifyAdminToken } from "@/app/admin/session";
import { readMaintenanceStatus, setMaintenanceSettings } from "@/app/maintenance-mode";

export const runtime = "nodejs";

async function requireAdmin(request: Request) {
  const password = process.env.ADMIN_PASSWORD ?? "";
  const token = readCookie(request.headers.get("cookie"), ADMIN_COOKIE_NAME);
  return verifyAdminToken(token, password);
}

export async function GET(request: Request) {
  if (!await requireAdmin(request)) return Response.json({ error: "admin_required" }, { status: 401 });
  const status = await readMaintenanceStatus({ fresh: true });
  return Response.json(status, { headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!await requireAdmin(request)) return Response.json({ error: "admin_required" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const durationMinutes = Number(body.durationMinutes);
  if (typeof body.enabled !== "boolean"
    || !Number.isInteger(durationMinutes)
    || durationMinutes < 1
    || durationMinutes > 24 * 60) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const status = await setMaintenanceSettings(body.enabled, durationMinutes);
  return Response.json(status, { headers: { "cache-control": "private, no-store" } });
}

import { ADMIN_COOKIE_NAME, readCookie, requestHasSameOrigin, verifyAdminToken } from "@/app/admin/session";
import { readMaintenanceMode, setMaintenanceMode } from "@/app/maintenance-mode";

export const runtime = "nodejs";

async function requireAdmin(request: Request) {
  const password = process.env.ADMIN_PASSWORD ?? "";
  const token = readCookie(request.headers.get("cookie"), ADMIN_COOKIE_NAME);
  return verifyAdminToken(token, password);
}

export async function GET(request: Request) {
  if (!await requireAdmin(request)) return Response.json({ error: "admin_required" }, { status: 401 });
  const enabled = await readMaintenanceMode({ fresh: true });
  return Response.json({ enabled }, { headers: { "cache-control": "private, no-store" } });
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

  if (typeof body.enabled !== "boolean") {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const enabled = await setMaintenanceMode(body.enabled);
  return Response.json({ enabled }, { headers: { "cache-control": "private, no-store" } });
}

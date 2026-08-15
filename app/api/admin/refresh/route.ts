import { ADMIN_COOKIE_NAME, ADMIN_SESSION_MAX_AGE, createAdminToken, readCookie, requestHasSameOrigin, verifyAdminToken } from "@/app/admin/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const password = process.env.ADMIN_PASSWORD ?? "";
  const currentToken = readCookie(request.headers.get("cookie"), ADMIN_COOKIE_NAME);
  if (!await verifyAdminToken(currentToken, password)) return Response.json({ error: "admin_login_required" }, { status: 401 });
  const token = await createAdminToken(password);
  return Response.json({ ok: true }, {
    headers: {
      "cache-control": "no-store",
      "set-cookie": `${ADMIN_COOKIE_NAME}=${token}; Path=/; Max-Age=${ADMIN_SESSION_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}

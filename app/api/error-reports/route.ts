import { consumeRateLimit } from "@/app/api/rate-limit";
import { authenticatedRequestProfile } from "@/app/auth/request-profile";
import { requestHasSameOrigin } from "@/app/auth/session";
import { getSqlClient } from "@/db";

export const runtime = "nodejs";

const categories = new Set(["screen", "access", "coupon", "other"]);

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });

  const profile = await authenticatedRequestProfile(request);
  if (!profile) return Response.json({ error: "auth_required" }, { status: 401 });
  if (profile.isBlocked) return Response.json({ error: "blocked" }, { status: 403 });

  let body: { category?: unknown; message?: unknown; pagePath?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const category = typeof body.category === "string" ? body.category : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const pagePath = typeof body.pagePath === "string" && body.pagePath.startsWith("/") && !body.pagePath.startsWith("//")
    ? body.pagePath.slice(0, 200)
    : "/";

  if (!categories.has(category) || message.length < 10 || message.length > 1000) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const usage = await consumeRateLimit(profile.id, "user_error_report", 3, 1440);
    if (usage === null) {
      return Response.json({ error: "rate_limit" }, { status: 429, headers: { "retry-after": "86400" } });
    }

    const sql = getSqlClient();
    await sql`
      insert into user_error_reports (reporter_id, category, message, page_path)
      values (${profile.id}::uuid, ${category}, ${message}, ${pagePath})
    `;
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("User error report failed", error);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}

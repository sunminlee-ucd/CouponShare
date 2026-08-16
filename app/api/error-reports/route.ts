import { consumeRateLimit } from "@/app/api/rate-limit";
import { getSqlClient } from "@/db";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const categories = new Set(["screen", "access", "coupon", "other"]);

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });

  let body: { deviceKey?: unknown; category?: unknown; message?: unknown; pagePath?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const deviceKey = typeof body.deviceKey === "string" ? body.deviceKey : "";
  const category = typeof body.category === "string" ? body.category : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const pagePath = typeof body.pagePath === "string" && body.pagePath.startsWith("/")
    ? body.pagePath.slice(0, 200)
    : "/";

  if (!uuidPattern.test(deviceKey) || !categories.has(category) || message.length < 10 || message.length > 1000) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const sql = getSqlClient();
    const [profile] = await sql<{ id: string; is_blocked: boolean }[]>`
      insert into profiles (device_key, updated_at)
      values (${deviceKey}::uuid, now())
      on conflict (device_key) do update set updated_at = now()
      returning id::text, is_blocked
    `;
    if (!profile || profile.is_blocked) return Response.json({ error: "blocked" }, { status: 403 });

    const usage = await consumeRateLimit(profile.id, "user_error_report", 3, 1440);
    if (usage === null) {
      return Response.json({ error: "rate_limit" }, { status: 429, headers: { "retry-after": "86400" } });
    }

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

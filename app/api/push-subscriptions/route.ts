import { authenticatedRequestProfile } from "@/app/auth/request-profile";
import { requestHasSameOrigin } from "@/app/auth/session";
import { getVapidPublicKey } from "@/app/notifications/web-push";
import { getSqlClient } from "@/db";
import type { NotificationLanguage } from "@/app/notifications/copy";

export const runtime = "nodejs";

const keyPattern = /^[A-Za-z0-9_-]{8,256}$/;
const languages = new Set<NotificationLanguage>(["ko", "en", "fa", "ja"]);

function validEndpoint(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const profile = await authenticatedRequestProfile(request);
  if (!profile) return Response.json({ error: "auth_required" }, { status: 401 });
  if (profile.isBlocked) return Response.json({ error: "unavailable" }, { status: 404 });

  const sql = getSqlClient();
  const [row] = await sql<{ count: number }[]>`
    select count(*)::int as count
    from web_push_subscriptions
    where profile_id = ${profile.id}::uuid
      and disabled_at is null
  `;
  return Response.json(
    { publicKey: getVapidPublicKey(), subscribed: Number(row?.count ?? 0) > 0 },
    { headers: { "cache-control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const profile = await authenticatedRequestProfile(request);
  if (!profile) return Response.json({ error: "auth_required" }, { status: 401 });
  if (profile.isBlocked) return Response.json({ error: "unavailable" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const endpoint = body.endpoint;
  const keys = body.keys && typeof body.keys === "object" ? body.keys as Record<string, unknown> : {};
  const p256dh = keys.p256dh;
  const auth = keys.auth;
  const language = languages.has(body.language as NotificationLanguage) ? body.language as NotificationLanguage : "ko";
  if (!validEndpoint(endpoint) || typeof p256dh !== "string" || !keyPattern.test(p256dh) || typeof auth !== "string" || !keyPattern.test(auth)) {
    return Response.json({ error: "invalid_subscription" }, { status: 400 });
  }

  const userAgent = (request.headers.get("user-agent") ?? "").slice(0, 300) || null;
  const sql = getSqlClient();
  await sql.begin(async (transaction) => {
    await transaction`
      insert into web_push_subscriptions (
        profile_id, endpoint, p256dh, auth, language, user_agent, disabled_at, updated_at
      ) values (
        ${profile.id}::uuid, ${endpoint as string}, ${p256dh}, ${auth}, ${language}, ${userAgent}, null, now()
      )
      on conflict (endpoint) do update
        set profile_id = excluded.profile_id,
            p256dh = excluded.p256dh,
            auth = excluded.auth,
            language = excluded.language,
            user_agent = excluded.user_agent,
            disabled_at = null,
            updated_at = now()
    `;
    await transaction`
      update web_push_subscriptions
      set disabled_at = now(), updated_at = now()
      where id in (
        select id
        from web_push_subscriptions
        where profile_id = ${profile.id}::uuid
          and disabled_at is null
        order by updated_at desc
        offset 5
      )
    `;
  });

  return Response.json({ ok: true, publicKey: getVapidPublicKey() }, { headers: { "cache-control": "private, no-store" } });
}

export async function DELETE(request: Request) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const profile = await authenticatedRequestProfile(request);
  if (!profile) return Response.json({ error: "auth_required" }, { status: 401 });

  let endpoint: string | null = null;
  try {
    const body = await request.json() as { endpoint?: unknown };
    if (typeof body.endpoint === "string" && body.endpoint.length <= 2048) endpoint = body.endpoint;
  } catch {
    // An empty body disables all subscriptions for the signed-in account.
  }

  const sql = getSqlClient();
  if (endpoint) {
    await sql`
      update web_push_subscriptions
      set disabled_at = now(), updated_at = now()
      where profile_id = ${profile.id}::uuid
        and endpoint = ${endpoint}
    `;
  } else {
    await sql`
      update web_push_subscriptions
      set disabled_at = now(), updated_at = now()
      where profile_id = ${profile.id}::uuid
        and disabled_at is null
    `;
  }
  return Response.json({ ok: true }, { headers: { "cache-control": "private, no-store" } });
}

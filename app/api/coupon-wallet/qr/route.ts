import { getSqlClient } from "@/db";

export const runtime = "nodejs";

const ALPHA_GROUP_CODE = "couponshare-alpha-v1";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const qrDataPattern = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const deviceKey = new URL(request.url).searchParams.get("deviceKey");
  if (!deviceKey || !uuidPattern.test(deviceKey)) return new Response("Not found", { status: 404 });

  try {
    const sql = getSqlClient();
    const [card] = await sql<{ qr_data: string }[]>`
      select card.qr_object_path as qr_data
      from profiles owner
      join lidl_cards card on card.owner_id = owner.id
      where owner.device_key = ${deviceKey}::uuid
        and owner.is_blocked = false
        and card.review_status <> 'rejected'
      limit 1
    `;
    const match = card?.qr_data?.match(qrDataPattern);
    if (!match) return new Response("Not found", { status: 404 });
    return new Response(Buffer.from(match[2], "base64"), {
      headers: {
        "content-type": match[1],
        "cache-control": "private, no-store, max-age=0",
        "content-security-policy": "default-src 'none'",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Own QR read failed", error);
    return new Response("Unavailable", { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });
  let body: { deviceKey?: string; ownerId?: string };
  try {
    body = await request.json() as { deviceKey?: string; ownerId?: string };
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const deviceKey = body.deviceKey ?? null;
  const ownerId = body.ownerId ?? null;
  if (!deviceKey || !ownerId || !uuidPattern.test(deviceKey) || !uuidPattern.test(ownerId)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const sql = getSqlClient();
    const result = await sql.begin(async (tx) => {
      const [card] = await tx<{ requester_id: string; qr_data: string }[]>`
        select requester.id::text as requester_id, card.qr_object_path as qr_data
        from profiles requester
        join group_members requester_membership on requester_membership.profile_id = requester.id
        join groups g on g.id = requester_membership.group_id and g.invite_code = ${ALPHA_GROUP_CODE}
        join group_members owner_membership on owner_membership.group_id = g.id
        join lidl_cards card on card.owner_id = owner_membership.profile_id
          and card.is_shared = true
          and card.review_status <> 'rejected'
        where requester.device_key = ${deviceKey}::uuid
          and requester.is_blocked = false
          and owner_membership.profile_id = ${ownerId}::uuid
        limit 1
      `;
      const match = card?.qr_data?.match(qrDataPattern);
      if (!card || !match) return { status: "not_found" as const };

      const [usage] = await tx<{ view_count: number }[]>`
        insert into qr_daily_usage (profile_id, usage_date, view_count, updated_at)
        values (${card.requester_id}::uuid, (now() at time zone 'Europe/Dublin')::date, 1, now())
        on conflict (profile_id, usage_date) do update set
          view_count = qr_daily_usage.view_count + 1,
          updated_at = now()
        where qr_daily_usage.view_count < 3
        returning view_count
      `;

      if (!usage) {
        await tx`
          update qr_daily_usage
          set blocked_attempts = blocked_attempts + 1, updated_at = now()
          where profile_id = ${card.requester_id}::uuid
            and usage_date = (now() at time zone 'Europe/Dublin')::date
        `;
        await tx`
          update profiles
          set
            risk_score = risk_score + 1,
            is_blocked = is_blocked or risk_score + 1 >= 10,
            updated_at = now()
          where id = ${card.requester_id}::uuid
        `;
        return { status: "limited" as const };
      }

      return { status: "allowed" as const, match, remaining: Math.max(0, 3 - usage.view_count) };
    });

    if (result.status === "not_found") return new Response("Not found", { status: 404 });
    if (result.status === "limited") {
      return Response.json({ error: "daily_qr_limit", remaining: 0 }, {
        status: 429,
        headers: { "cache-control": "private, no-store, max-age=0" },
      });
    }
    return new Response(Buffer.from(result.match[2], "base64"), {
      headers: {
        "content-type": result.match[1],
        "cache-control": "private, no-store, max-age=0",
        "content-security-policy": "default-src 'none'",
        "x-content-type-options": "nosniff",
        "x-qr-views-remaining": String(result.remaining),
      },
    });
  } catch (error) {
    console.error("Shared QR read failed", error);
    return new Response("Unavailable", { status: 503 });
  }
}

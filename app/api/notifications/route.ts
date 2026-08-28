import { authenticatedRequestProfile } from "@/app/auth/request-profile";
import { requestHasSameOrigin } from "@/app/auth/session";
import { getSqlClient } from "@/db";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type NotificationRow = {
  id: string;
  voucher_id: string;
  voucher_label: string;
  membership_required: boolean;
  created_at: string;
};

export async function GET(request: Request) {
  const profile = await authenticatedRequestProfile(request);
  if (!profile) return Response.json({ error: "auth_required" }, { status: 401 });
  if (profile.isBlocked) return Response.json({ error: "unavailable" }, { status: 404 });

  const sql = getSqlClient();
  const notifications = await sql<NotificationRow[]>`
    select
      n.id::text,
      n.voucher_id::text,
      case v.voucher_type
        when '5off25' then '€5 OFF €25'
        when '10off40' then '€10 OFF €40'
        else '€10 OFF €50'
      end as voucher_label,
      v.membership_required,
      n.created_at::text
    from user_notifications n
    join dunnes_vouchers v on v.id = n.voucher_id
    where n.recipient_profile_id = ${profile.id}::uuid
      and n.type = 'voucher_unused_confirmation'
      and n.status = 'unread'
      and v.owner_id = ${profile.id}::uuid
      and v.status = 'reserved'
      and v.reserved_by is null
    order by n.created_at asc
    limit 10
  `;

  return Response.json({ notifications }, { headers: { "cache-control": "private, no-store" } });
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

  const notificationId = typeof body.notificationId === "string" ? body.notificationId : "";
  const resolution = body.resolution === "released" || body.resolution === "used" ? body.resolution : null;
  if (!uuidPattern.test(notificationId) || !resolution) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const sql = getSqlClient();
  const outcome = await sql.begin(async (transaction) => {
    const [notification] = await transaction<{
      id: string;
      voucher_id: string;
      owner_id: string;
    }[]>`
      select
        n.id::text,
        n.voucher_id::text,
        v.owner_id::text
      from user_notifications n
      join dunnes_vouchers v on v.id = n.voucher_id
      where n.id = ${notificationId}::uuid
        and n.recipient_profile_id = ${profile.id}::uuid
        and n.type = 'voucher_unused_confirmation'
        and n.status = 'unread'
      for update of n, v
    `;
    if (!notification || notification.owner_id !== profile.id) return null;

    const [voucher] = resolution === "used"
      ? await transaction<{ status: string }[]>`
          update dunnes_vouchers
          set status = 'used',
              reserved_by = null,
              reserved_at = null,
              used_at = now(),
              updated_at = now()
          where id = ${notification.voucher_id}::uuid
            and owner_id = ${profile.id}::uuid
            and status = 'reserved'
            and reserved_by is null
          returning status
        `
      : await transaction<{ status: string }[]>`
          update dunnes_vouchers
          set status = case
                when expires_on < (now() at time zone 'Europe/Dublin')::date then 'expired'
                else 'available'
              end,
              reserved_by = null,
              reserved_at = null,
              used_at = null,
              updated_at = now()
          where id = ${notification.voucher_id}::uuid
            and owner_id = ${profile.id}::uuid
            and status = 'reserved'
            and reserved_by is null
          returning status
        `;

    if (!voucher) return { stale: true as const, status: null };

    await transaction`
      update user_notifications
      set status = 'resolved',
          resolution = ${resolution},
          resolved_at = now()
      where id = ${notification.id}::uuid
        and recipient_profile_id = ${profile.id}::uuid
        and status = 'unread'
    `;

    return { stale: false as const, status: voucher.status };
  });

  if (!outcome) return Response.json({ error: "notification_not_found" }, { status: 404 });
  if (outcome.stale) return Response.json({ error: "notification_stale" }, { status: 409 });
  return Response.json({ ok: true, status: outcome.status }, { headers: { "cache-control": "private, no-store" } });
}

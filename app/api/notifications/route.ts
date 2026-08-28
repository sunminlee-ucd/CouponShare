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
      v.id::text as id,
      v.id::text as voucher_id,
      case v.voucher_type
        when '5off25' then '€5 OFF €25'
        when '10off40' then '€10 OFF €40'
        else '€10 OFF €50'
      end as voucher_label,
      v.membership_required,
      v.updated_at::text as created_at
    from dunnes_vouchers v
    where v.owner_id = ${profile.id}::uuid
      and v.status = 'reserved'
      and v.reserved_by is null
      and v.reserved_at is null
      and v.used_at is null
    order by v.updated_at asc
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
  const [voucher] = resolution === "used"
    ? await sql<{ status: string }[]>`
        update dunnes_vouchers
        set status = 'used',
            reserved_by = null,
            reserved_at = null,
            used_at = now(),
            updated_at = now()
        where id = ${notificationId}::uuid
          and owner_id = ${profile.id}::uuid
          and status = 'reserved'
          and reserved_by is null
          and reserved_at is null
        returning status
      `
    : await sql<{ status: string }[]>`
        update dunnes_vouchers
        set status = case
              when expires_on < (now() at time zone 'Europe/Dublin')::date then 'expired'
              else 'available'
            end,
            reserved_by = null,
            reserved_at = null,
            used_at = null,
            updated_at = now()
        where id = ${notificationId}::uuid
          and owner_id = ${profile.id}::uuid
          and status = 'reserved'
          and reserved_by is null
          and reserved_at is null
        returning status
      `;

  if (!voucher) return Response.json({ error: "notification_not_found" }, { status: 404 });
  return Response.json({ ok: true, status: voucher.status }, { headers: { "cache-control": "private, no-store" } });
}

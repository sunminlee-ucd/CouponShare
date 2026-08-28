import { getSqlClient } from "@/db";
import { authenticatedRequestContext } from "@/app/auth/request-profile";

export const runtime = "nodejs";

type VoucherRow = {
  id: string;
  voucher_type: "5off25" | "10off40" | "10off50";
  barcode_masked: string;
  image_data: string | null;
  membership_required: boolean;
  membership_image_data: string | null;
  expires_on: string;
  status: "available" | "reserved" | "used" | "expired" | "rejected";
  review_status: "pending" | "approved" | "rejected";
  is_mine: boolean;
  reserved_by_me: boolean;
  reserved_until: string | null;
};

async function signedInState(profileId: string) {
  const sql = getSqlClient();
  const [rows, usageRows] = await Promise.all([
    sql<VoucherRow[]>`
      select
        v.id::text,
        v.voucher_type,
        '•••• ' || right(v.barcode, 4) as barcode_masked,
        case
          when v.status = 'reserved'
            and v.reserved_by = ${profileId}::uuid
            and v.reserved_at is not null
            and v.reserved_at >= now() - interval '30 minutes'
          then v.image_data
          else null
        end as image_data,
        v.membership_required,
        case
          when v.membership_required
            and v.status = 'reserved'
            and v.reserved_by = ${profileId}::uuid
            and v.reserved_at is not null
            and v.reserved_at >= now() - interval '30 minutes'
          then v.membership_image_data
          else null
        end as membership_image_data,
        v.expires_on::text,
        case
          when v.status = 'reserved'
            and v.reserved_at is not null
            and v.reserved_at < now() - interval '30 minutes'
          then 'available'
          else v.status
        end as status,
        v.review_status,
        v.owner_id = ${profileId}::uuid as is_mine,
        case
          when v.status = 'reserved'
            and v.reserved_at is not null
            and v.reserved_at < now() - interval '30 minutes'
          then false
          else v.reserved_by = ${profileId}::uuid
        end as reserved_by_me,
        case
          when v.status = 'reserved'
            and v.reserved_at is not null
            and v.reserved_at >= now() - interval '30 minutes'
          then (v.reserved_at + interval '30 minutes')::text
          else null
        end as reserved_until
      from dunnes_vouchers v
      join profiles owner on owner.id = v.owner_id and owner.is_blocked = false
      where v.expires_on >= (now() at time zone 'Europe/Dublin')::date
        and v.status in ('available', 'reserved')
        and (
          (v.review_status = 'approved' and v.owner_id <> ${profileId}::uuid)
          or v.owner_id = ${profileId}::uuid
        )
      order by v.expires_on, v.created_at
    `,
    sql<{ reservation_count: number }[]>`
      select reservation_count
      from dunnes_daily_reservations
      where profile_id = ${profileId}::uuid
        and usage_date = (now() at time zone 'Europe/Dublin')::date
      limit 1
    `,
  ]);

  return {
    vouchers: rows,
    reservationsRemaining: Math.max(0, 3 - Number(usageRows[0]?.reservation_count ?? 0)),
  };
}

async function browseState() {
  const sql = getSqlClient();
  const rows = await sql<VoucherRow[]>`
    select
      v.id::text,
      v.voucher_type,
      '•••• ' || right(v.barcode, 4) as barcode_masked,
      null::text as image_data,
      v.membership_required,
      null::text as membership_image_data,
      v.expires_on::text,
      case
        when v.status = 'reserved'
          and v.reserved_at is not null
          and v.reserved_at < now() - interval '30 minutes'
        then 'available'
        else v.status
      end as status,
      v.review_status,
      false as is_mine,
      false as reserved_by_me,
      case
        when v.status = 'reserved'
          and v.reserved_at is not null
          and v.reserved_at >= now() - interval '30 minutes'
        then (v.reserved_at + interval '30 minutes')::text
        else null
      end as reserved_until
    from dunnes_vouchers v
    join profiles owner on owner.id = v.owner_id and owner.is_blocked = false
    where v.status in ('available', 'reserved')
      and v.review_status = 'approved'
      and v.expires_on >= (now() at time zone 'Europe/Dublin')::date
    order by v.expires_on, v.created_at
  `;

  return { vouchers: rows, reservationsRemaining: 0 };
}

export async function GET(request: Request) {
  try {
    const context = await authenticatedRequestContext(request);
    if (context.session && !context.profile) {
      return Response.json({ error: "auth_required" }, { status: 401 });
    }
    if (context.profile?.isBlocked) {
      return Response.json({ error: "blocked" }, { status: 403 });
    }

    const state = context.profile ? await signedInState(context.profile.id) : await browseState();
    return Response.json(state, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    console.error("Dunnes state read failed", error);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}

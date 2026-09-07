import { getSqlClient } from "@/db";
import { ADMIN_COOKIE_NAME, readCookie, verifyAdminToken } from "@/app/admin/session";
import { tidyDunnesVouchers } from "@/app/dunnes/tidy-vouchers";

export const runtime = "nodejs";

type ReviewRow = {
  voucher_id: string;
  voucher_label: string;
  barcode: string;
  membership_required: boolean;
  has_membership_image: boolean;
  expires_on: string;
  review_status: "pending" | "approved";
  status: "available" | "reserved";
  usage_confirmation_pending: boolean;
  owner_profile_id: string;
  owner_auth_user_id: string | null;
  owner_email: string | null;
  owner_provider: string | null;
  updated_at: string;
};

type OwnerAccount = {
  auth_user_id: string;
  email: string | null;
  provider: string | null;
};

export async function GET(request: Request) {
  const password = process.env.ADMIN_PASSWORD ?? "";
  const token = readCookie(request.headers.get("cookie"), ADMIN_COOKIE_NAME);
  if (!await verifyAdminToken(token, password)) return Response.json({ error: "admin_auth_required" }, { status: 401 });

  try {
    await tidyDunnesVouchers();
    const sql = getSqlClient();
    const rows = await sql<ReviewRow[]>`
      select
        v.id::text as voucher_id,
        case v.voucher_type
          when '5off25' then '€5 OFF €25'
          when '10off40' then '€10 OFF €40'
          else '€10 OFF €50'
        end as voucher_label,
        v.barcode,
        v.membership_required,
        v.membership_image_data is not null as has_membership_image,
        v.expires_on::text,
        v.review_status,
        v.status,
        (
          v.status = 'reserved'
          and v.reserved_by is null
          and v.reserved_at is null
          and v.used_at is null
        ) as usage_confirmation_pending,
        p.id::text as owner_profile_id,
        p.auth_user_id::text as owner_auth_user_id,
        null::text as owner_email,
        case when p.auth_user_id is null then 'profile' else 'account' end as owner_provider,
        to_char(v.updated_at at time zone 'Europe/Dublin', 'DD Mon HH24:MI') as updated_at
      from dunnes_vouchers v
      join profiles p on p.id = v.owner_id
      where v.review_status in ('approved', 'pending')
        and v.status in ('available', 'reserved')
        and v.expires_on >= (now() at time zone 'Europe/Dublin')::date
      order by v.created_at desc
      limit 50
    `;

    if (rows.some((row) => row.owner_auth_user_id)) {
      try {
        const accounts = await sql<OwnerAccount[]>`
          select
            u.id::text as auth_user_id,
            u.email,
            coalesce(u.raw_app_meta_data ->> 'provider', 'email') as provider
          from auth.users u
          where u.id in (
            select distinct p.auth_user_id
            from profiles p
            join dunnes_vouchers v on v.owner_id = p.id
            where p.auth_user_id is not null
              and v.review_status in ('approved', 'pending')
              and v.status in ('available', 'reserved')
              and v.expires_on >= (now() at time zone 'Europe/Dublin')::date
          )
        `;
        const accountById = new Map(accounts.map((account) => [account.auth_user_id, account]));
        for (const row of rows) {
          if (!row.owner_auth_user_id) continue;
          const account = accountById.get(row.owner_auth_user_id);
          if (!account) continue;
          row.owner_email = account.email;
          row.owner_provider = account.provider;
        }
      } catch (error) {
        console.warn("Admin Dunnes voucher owner auth lookup unavailable; using profile fallback", error);
      }
    }

    return Response.json({ reviews: rows }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    console.error("Admin Dunnes review queue read failed", error);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}

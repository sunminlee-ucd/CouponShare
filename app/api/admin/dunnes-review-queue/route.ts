import { getSqlClient } from "@/db";
import { ADMIN_COOKIE_NAME, readCookie, verifyAdminToken } from "@/app/admin/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const password = process.env.ADMIN_PASSWORD ?? "";
  const token = readCookie(request.headers.get("cookie"), ADMIN_COOKIE_NAME);
  if (!await verifyAdminToken(token, password)) return Response.json({ error: "admin_auth_required" }, { status: 401 });

  const sql = getSqlClient();
  const rows = await sql<Array<{
    voucher_id: string;
    voucher_label: string;
    barcode: string;
    membership_required: boolean;
    has_membership_image: boolean;
    expires_on: string;
    review_status: "pending" | "approved";
    status: "available" | "reserved";
    usage_confirmation_pending: boolean;
    updated_at: string;
  }>>`
    select
      id::text as voucher_id,
      case voucher_type
        when '5off25' then '€5 OFF €25'
        when '10off40' then '€10 OFF €40'
        else '€10 OFF €50'
      end as voucher_label,
      barcode,
      membership_required,
      membership_image_data is not null as has_membership_image,
      expires_on::text,
      review_status,
      status,
      (
        status = 'reserved'
        and reserved_by is null
        and reserved_at is null
        and used_at is null
      ) as usage_confirmation_pending,
      to_char(updated_at at time zone 'Europe/Dublin', 'DD Mon HH24:MI') as updated_at
    from dunnes_vouchers
    where review_status in ('approved', 'pending')
      and status in ('available', 'reserved')
    order by created_at desc
    limit 50
  `;

  return Response.json({ reviews: rows }, { headers: { "cache-control": "private, no-store" } });
}

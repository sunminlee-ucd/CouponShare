import { getSqlClient } from "@/db";
import { ADMIN_COOKIE_NAME, readCookie, verifyAdminToken } from "@/app/admin/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const password = process.env.ADMIN_PASSWORD ?? "";
  const token = readCookie(request.headers.get("cookie"), ADMIN_COOKIE_NAME);
  if (!await verifyAdminToken(token, password)) {
    return Response.json({ error: "admin_auth_required" }, { status: 401 });
  }

  const sql = getSqlClient();
  const rows = await sql<Array<{
    voucher_id: string;
    voucher_label: string;
    membership_required: boolean;
    expires_on: string;
    reserved_until: string | null;
    owner_label: string;
    reserver_label: string;
  }>>`
    select
      v.id::text as voucher_id,
      case v.voucher_type
        when '5off25' then '€5 OFF €25'
        when '10off40' then '€10 OFF €40'
        else '€10 OFF €50'
      end as voucher_label,
      v.membership_required,
      v.expires_on::text,
      to_char(v.reserved_until at time zone 'Europe/Dublin', 'DD Mon HH24:MI') as reserved_until,
      '등록자 · ' || upper(substr(md5(v.owner_id::text || current_date::text), 1, 3)) as owner_label,
      '예약자 · ' || upper(substr(md5(v.reserved_by::text || current_date::text), 1, 3)) as reserver_label
    from dunnes_vouchers v
    where v.status = 'reserved'
      and v.reserved_by is not null
      and (v.reserved_until is null or v.reserved_until > now())
    order by v.reserved_until asc nulls last, v.updated_at desc
    limit 100
  `;

  return Response.json({ reservations: rows }, { headers: { "cache-control": "private, no-store" } });
}

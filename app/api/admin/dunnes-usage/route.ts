import { getSqlClient } from "@/db";
import { ADMIN_COOKIE_NAME, readCookie, verifyAdminToken } from "@/app/admin/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const password = process.env.ADMIN_PASSWORD ?? "";
  const token = readCookie(request.headers.get("cookie"), ADMIN_COOKIE_NAME);
  if (!await verifyAdminToken(token, password)) {
    return Response.json({ error: "admin_auth_required" }, { status: 401 });
  }

  try {
    const sql = getSqlClient();
    const [summaryRows, daily, recent] = await Promise.all([
      sql<Array<{
        total_used: number;
        used_today: number;
        used_last_7_days: number;
        users_today: number;
      }>>`
        select
          count(*) filter (where status = 'used' and used_at is not null)::int as total_used,
          count(*) filter (
            where status = 'used' and used_at is not null
              and (used_at at time zone 'Europe/Dublin')::date = (now() at time zone 'Europe/Dublin')::date
          )::int as used_today,
          count(*) filter (
            where status = 'used' and used_at is not null
              and (used_at at time zone 'Europe/Dublin')::date >= (now() at time zone 'Europe/Dublin')::date - 6
          )::int as used_last_7_days,
          count(distinct reserved_by) filter (
            where status = 'used' and used_at is not null and reserved_by is not null
              and (used_at at time zone 'Europe/Dublin')::date = (now() at time zone 'Europe/Dublin')::date
          )::int as users_today
        from dunnes_vouchers
      `,
      sql<Array<{ usage_date: string; uses: number }>>`
        with dates as (
          select generate_series(
            (now() at time zone 'Europe/Dublin')::date - 6,
            (now() at time zone 'Europe/Dublin')::date,
            interval '1 day'
          )::date as usage_date
        )
        select
          to_char(dates.usage_date, 'DD Mon') as usage_date,
          count(v.id)::int as uses
        from dates
        left join dunnes_vouchers v
          on v.status = 'used'
          and v.used_at is not null
          and (v.used_at at time zone 'Europe/Dublin')::date = dates.usage_date
        group by dates.usage_date
        order by dates.usage_date
      `,
      sql<Array<{
        voucher_id: string;
        voucher_label: string;
        owner_label: string;
        user_label: string;
        membership_required: boolean;
        used_at: string;
      }>>`
        select
          v.id::text as voucher_id,
          case v.voucher_type
            when '5off25' then '€5 OFF €25'
            when '10off40' then '€10 OFF €40'
            else '€10 OFF €50'
          end as voucher_label,
          '등록자 · ' || upper(substr(md5(v.owner_id::text), 1, 5)) as owner_label,
          case
            when v.reserved_by is null then '사용자 기록 없음'
            else '사용자 · ' || upper(substr(md5(v.reserved_by::text), 1, 5))
          end as user_label,
          v.membership_required,
          to_char(v.used_at at time zone 'Europe/Dublin', 'DD Mon YYYY HH24:MI') as used_at
        from dunnes_vouchers v
        where v.status = 'used' and v.used_at is not null
        order by v.used_at desc
        limit 50
      `,
    ]);

    const summary = summaryRows[0] ?? { total_used: 0, used_today: 0, used_last_7_days: 0, users_today: 0 };
    return Response.json(
      { summary, daily, recent },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    console.error("Admin Dunnes usage analytics failed", error);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}

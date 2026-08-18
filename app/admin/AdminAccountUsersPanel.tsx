import { cookies } from "next/headers";
import { getSqlClient } from "@/db";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/app/admin/session";
import AdminAccountUsersTable, { type AdminAccountUser } from "./AdminAccountUsersTable";

export default async function AdminAccountUsersPanel() {
  const password = process.env.ADMIN_PASSWORD ?? "";
  const cookieStore = await cookies();
  if (!await verifyAdminToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value, password)) return null;

  try {
    const sql = getSqlClient();
    const users = await sql<AdminAccountUser[]>`
      select
        p.id::text as profile_id,
        u.id::text as auth_user_id,
        u.email,
        coalesce(u.raw_app_meta_data ->> 'provider', 'email') as provider,
        to_char(u.created_at at time zone 'Europe/Dublin', 'DD Mon YYYY HH24:MI') as account_created_at,
        case
          when p.id is null then null
          else to_char(p.updated_at at time zone 'Europe/Dublin', 'DD Mon YYYY HH24:MI')
        end as last_activity,
        coalesce(dr.reservation_count, 0)::int as today_reservations,
        coalesce(ul.request_count, 0)::int as today_uploads,
        coalesce(vc.registered_vouchers, 0)::int as registered_vouchers,
        coalesce(p.risk_score, 0)::int as risk_score,
        coalesce(p.is_blocked, false) as is_blocked,
        coalesce(q.view_count, 0)::int as today_views,
        coalesce(q.blocked_attempts, 0)::int as blocked_attempts
      from auth.users u
      full outer join profiles p on p.auth_user_id = u.id
      left join dunnes_daily_reservations dr on dr.profile_id = p.id
        and dr.usage_date = (now() at time zone 'Europe/Dublin')::date
      left join api_rate_limits ul on ul.profile_id = p.id
        and ul.action = 'dunnes:upload'
        and ul.window_start = to_timestamp(floor(extract(epoch from now()) / 86400) * 86400)
      left join qr_daily_usage q on q.profile_id = p.id
        and q.usage_date = (now() at time zone 'Europe/Dublin')::date
      left join lateral (
        select count(*)::int as registered_vouchers
        from dunnes_vouchers v
        where v.owner_id = p.id
      ) vc on true
      order by
        (u.email is null) asc,
        greatest(
          coalesce(p.updated_at, '1970-01-01'::timestamptz),
          coalesce(u.updated_at, u.created_at, '1970-01-01'::timestamptz)
        ) desc
      limit 250
    `;

    return <AdminAccountUsersTable users={users} />;
  } catch (error) {
    console.error("Admin account user lookup failed", error);
    return (
      <section className="admin-panel admin-account-users-error">
        <header className="admin-panel-head"><h2>계정 사용자 관리</h2><span>조회 실패</span></header>
        <p className="admin-action-note" role="alert">사용자 계정 정보를 불러오지 못했습니다. DB 연결과 auth.users 조회 권한을 확인해 주세요.</p>
      </section>
    );
  }
}

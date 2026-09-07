import { ADMIN_COOKIE_NAME, readCookie, verifyAdminToken } from "@/app/admin/session";
import { LIDL_ENABLED } from "@/app/features";
import { getSqlClient } from "@/db";

export const runtime = "nodejs";

export type DashboardSummary = {
  summary: {
    profiles: number;
    shared_cards: number;
    active_coupons: number;
    pending_lidl: number;
    pending_dunnes: number;
    open_lidl_reports: number;
    open_dunnes_reports: number;
    risk_users: number;
  };
  daily: { qr_views: number; blocked_attempts: number };
  dunnes_today: { viewers: number; views: number; users: number; uses: number };
};

async function requireAdmin(request: Request) {
  const password = process.env.ADMIN_PASSWORD ?? "";
  const token = readCookie(request.headers.get("cookie"), ADMIN_COOKIE_NAME);
  return verifyAdminToken(token, password);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Admin summary query timed out.")), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function loadDashboardSummary() {
  const sql = getSqlClient();

  if (!LIDL_ENABLED) {
    const [loaded] = await withTimeout(sql<DashboardSummary[]>`
      select
        json_build_object(
          'profiles', (select count(*)::int from profiles),
          'shared_cards', 0,
          'active_coupons', 0,
          'pending_lidl', 0,
          'pending_dunnes', (select count(*)::int from dunnes_vouchers where review_status = 'pending'),
          'open_lidl_reports', 0,
          'open_dunnes_reports', (select count(*)::int from dunnes_voucher_reports where status = 'open'),
          'risk_users', (
            select count(*)::int
            from profiles p
            where p.risk_score > 0 or p.is_blocked = true
          )
        ) as summary,
        json_build_object(
          'qr_views', 0,
          'blocked_attempts', 0
        ) as daily,
        json_build_object(
          'viewers', (select count(distinct profile_id)::int from dunnes_voucher_activity where event_type = 'viewed' and (occurred_at at time zone 'Europe/Dublin')::date = (now() at time zone 'Europe/Dublin')::date),
          'views', (select count(*)::int from dunnes_voucher_activity where event_type = 'viewed' and (occurred_at at time zone 'Europe/Dublin')::date = (now() at time zone 'Europe/Dublin')::date),
          'users', (select count(distinct reserved_by)::int from dunnes_vouchers where status = 'used' and used_at is not null and (used_at at time zone 'Europe/Dublin')::date = (now() at time zone 'Europe/Dublin')::date),
          'uses', (select count(*)::int from dunnes_vouchers where status = 'used' and used_at is not null and (used_at at time zone 'Europe/Dublin')::date = (now() at time zone 'Europe/Dublin')::date)
        ) as dunnes_today
    `, 2_500);
    return loaded;
  }

  const [loaded] = await withTimeout(sql<DashboardSummary[]>`
    select
      json_build_object(
        'profiles', (select count(*)::int from profiles),
        'shared_cards', (select count(*)::int from lidl_cards where is_shared = true and review_status <> 'rejected'),
        'active_coupons', (select count(*)::int from coupons where is_active = true and used_at is null),
        'pending_lidl', (select count(*)::int from lidl_cards where review_status = 'pending'),
        'pending_dunnes', (select count(*)::int from dunnes_vouchers where review_status = 'pending'),
        'open_lidl_reports', (select count(*)::int from lidl_card_reports where status = 'open'),
        'open_dunnes_reports', (select count(*)::int from dunnes_voucher_reports where status = 'open'),
        'risk_users', (
          select count(*)::int
          from profiles p
          left join qr_daily_usage u on u.profile_id = p.id
            and u.usage_date = (now() at time zone 'Europe/Dublin')::date
          where p.risk_score > 0 or p.is_blocked = true or coalesce(u.blocked_attempts, 0) > 0
        )
      ) as summary,
      json_build_object(
        'qr_views', (select coalesce(sum(view_count), 0)::int from qr_daily_usage where usage_date = (now() at time zone 'Europe/Dublin')::date),
        'blocked_attempts', (select coalesce(sum(blocked_attempts), 0)::int from qr_daily_usage where usage_date = (now() at time zone 'Europe/Dublin')::date)
      ) as daily,
      json_build_object(
        'viewers', (select count(distinct profile_id)::int from dunnes_voucher_activity where event_type = 'viewed' and (occurred_at at time zone 'Europe/Dublin')::date = (now() at time zone 'Europe/Dublin')::date),
        'views', (select count(*)::int from dunnes_voucher_activity where event_type = 'viewed' and (occurred_at at time zone 'Europe/Dublin')::date = (now() at time zone 'Europe/Dublin')::date),
        'users', (select count(distinct reserved_by)::int from dunnes_vouchers where status = 'used' and used_at is not null and (used_at at time zone 'Europe/Dublin')::date = (now() at time zone 'Europe/Dublin')::date),
        'uses', (select count(*)::int from dunnes_vouchers where status = 'used' and used_at is not null and (used_at at time zone 'Europe/Dublin')::date = (now() at time zone 'Europe/Dublin')::date)
      ) as dunnes_today
  `, 2_500);
  return loaded;
}

export async function GET(request: Request) {
  if (!await requireAdmin(request)) return Response.json({ error: "admin_required" }, { status: 401 });

  try {
    const dashboard = await loadDashboardSummary();
    if (!dashboard) return Response.json({ error: "summary_unavailable" }, { status: 503 });
    return Response.json(dashboard, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    console.error("Admin summary lookup failed", error);
    return Response.json({ error: "summary_unavailable" }, {
      status: 503,
      headers: { "cache-control": "private, no-store" },
    });
  }
}

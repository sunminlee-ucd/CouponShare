import type { Metadata } from "next";
import AdminSectionFrame from "@/app/admin/AdminSectionFrame";
import { requireAdminPage } from "@/app/admin/require-page-session";
import { LIDL_ENABLED } from "@/app/features";
import { getSqlClient } from "@/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CouponShare Admin",
  description: "CouponShare 운영 요약",
};

type Summary = {
  profiles: number;
  shared_cards: number;
  active_coupons: number;
  pending_lidl: number;
  pending_dunnes: number;
  open_lidl_reports: number;
  open_dunnes_reports: number;
  risk_users: number;
};

type DailyUsage = { qr_views: number; blocked_attempts: number };
type DunnesToday = { viewers: number; views: number; users: number; uses: number };

type DashboardSummary = {
  summary: Summary;
  daily: DailyUsage;
  dunnes_today: DunnesToday;
};

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Admin summary query timed out.")), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

const EMPTY: DashboardSummary = {
  summary: {
    profiles: 0,
    shared_cards: 0,
    active_coupons: 0,
    pending_lidl: 0,
    pending_dunnes: 0,
    open_lidl_reports: 0,
    open_dunnes_reports: 0,
    risk_users: 0,
  },
  daily: { qr_views: 0, blocked_attempts: 0 },
  dunnes_today: { viewers: 0, views: 0, users: 0, uses: 0 },
};

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
    `, 3_000);
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
  `, 3_000);
  return loaded;
}

export default async function AdminPage() {
  await requireAdminPage("/admin");

  let dashboardUnavailable = false;
  let dashboard = EMPTY;

  try {
    const loaded = await loadDashboardSummary();
    if (loaded) dashboard = loaded;
  } catch (error) {
    dashboardUnavailable = true;
    console.error("Admin summary lookup failed", error);
  }

  const { summary, daily, dunnes_today: dunnesToday } = dashboard;
  const pendingCount = summary.pending_dunnes + summary.open_dunnes_reports
    + (LIDL_ENABLED ? summary.pending_lidl + summary.open_lidl_reports : 0);

  const stats = [
    { label: "등록 사용자", value: summary.profiles, detail: LIDL_ENABLED ? `공유 카드 ${summary.shared_cards}개` : "Dunnes 중심 운영" },
    ...(LIDL_ENABLED ? [
      { label: "활성 Lidl 쿠폰", value: summary.active_coupons, detail: "사용 완료 제외" },
      { label: "오늘 QR 열람", value: daily.qr_views, detail: "사용자별 최대 3회" },
    ] : []),
    { label: "오늘 Dunnes 열람", value: dunnesToday.viewers, detail: `총 ${dunnesToday.views}회` },
    { label: "오늘 Dunnes 사용", value: dunnesToday.users, detail: `총 ${dunnesToday.uses}건` },
    { label: "검수·위험", value: pendingCount + summary.risk_users, detail: `위험 사용자 ${summary.risk_users}명` },
  ];

  return (
    <AdminSectionFrame>
      <section className="admin-main" id="overview">
        {dashboardUnavailable && (
          <p className="admin-data-warning" role="status">
            운영 요약 조회가 지연되고 있습니다. 다른 관리자 메뉴는 계속 이용할 수 있습니다.
          </p>
        )}
        <div className="admin-heading">
          <div>
            <p className="eyebrow">LIVE OPERATIONS</p>
            <h1>관리자 대시보드</h1>
            <p>첫 화면은 운영 요약만 빠르게 불러옵니다. 세부 데이터는 각 메뉴를 열 때 조회합니다.</p>
          </div>
          <span className="admin-date">
            Ireland · {new Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeZone: "Europe/Dublin" }).format(new Date())}
          </span>
        </div>
        <div className="admin-stats">
          {stats.map((stat) => (
            <article className="admin-stat" key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <small>{stat.detail}</small>
            </article>
          ))}
        </div>
        <div className="admin-grid">
          <div className="admin-column">
            <section className="admin-panel" id="policy">
              <header className="admin-panel-head"><h2>운영 정책</h2><span>서버 적용</span></header>
              <div className="policy-list">
                {LIDL_ENABLED && <div className="policy-row"><div><strong>Lidl QR 일일 열람</strong><span>아일랜드 날짜 기준</span></div><span className="policy-value">3회</span></div>}
                <div className="policy-row"><div><strong>Dunnes 예약</strong><span>30분 후 자동 해제</span></div><span className="policy-value">3개/일</span></div>
                <div className="policy-row"><div><strong>신규 Dunnes 업로드</strong><span>관리자 승인 후 공개</span></div><span className="policy-value">2개/일</span></div>
                <div className="policy-row"><div><strong>업로드 거절</strong><span>연결 데이터 삭제</span></div><span className="policy-value">즉시</span></div>
              </div>
            </section>
          </div>
        </div>
        <footer className="admin-footer">© 2026 Sunmin Lee. 관리자 전용 화면.</footer>
      </section>
    </AdminSectionFrame>
  );
}

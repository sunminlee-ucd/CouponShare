import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSqlClient } from "@/db";
import { accessConfiguration } from "@/app/access/session";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/app/admin/session";
import AdminSessionRefresh from "@/app/admin/AdminSessionRefresh";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CouponShare Admin",
  description: "CouponShare 검수 및 위험 사용자 관리",
};

type Summary = {
  profiles: number;
  shared_cards: number;
  active_coupons: number;
  pending_lidl: number;
  pending_dunnes: number;
  open_lidl_reports: number;
  open_dunnes_reports: number;
};
type DailyUsage = { qr_views: number; blocked_attempts: number };
type DunnesToday = { viewers: number; views: number; users: number; uses: number };
type LidlReview = {
  card_id: string;
  card_label: string;
  review_status: "pending" | "approved" | "rejected";
  coupon_count: number;
  updated_at: string;
};
type DunnesReview = {
  voucher_id: string;
  voucher_label: string;
  membership_required: boolean;
  expires_on: string;
  updated_at: string;
};
type RiskRow = {
  profile_id: string;
  user_label: string;
  risk_score: number;
  is_blocked: boolean;
  today_views: number;
  blocked_attempts: number;
};
type DunnesReport = {
  report_id: string;
  voucher_id: string;
  voucher_label: string;
  reason: "invalid_voucher" | "membership_not_scanned";
  report_count: number;
  created_at: string;
};
type LidlReport = {
  card_id: string;
  card_label: string;
  reason: "invalid_qr" | "unrelated_image" | "coupon_mismatch";
  report_count: number;
  created_at: string;
};

type DashboardBundle = {
  summary: Summary;
  daily: DailyUsage;
  dunnes_today: DunnesToday;
  lidl_reviews: LidlReview[];
  dunnes_reviews: DunnesReview[];
  lidl_reports: LidlReport[];
  dunnes_reports: DunnesReport[];
  risks: RiskRow[];
};

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Admin dashboard query timed out.")), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export default async function AdminPage() {
  const password = process.env.ADMIN_PASSWORD ?? "";
  const cookieStore = await cookies();
  if (!await verifyAdminToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value, password)) redirect("/admin/login?returnTo=%2Fadmin");
  const sql = getSqlClient();
  const access = await accessConfiguration();
  let dashboardUnavailable = false;
  let dashboard: DashboardBundle;
  try {
    const [loaded] = await withTimeout(sql<DashboardBundle[]>`
      select
        json_build_object(
          'profiles', (select count(*)::int from profiles),
          'shared_cards', (select count(*)::int from lidl_cards where is_shared = true and review_status <> 'rejected'),
          'active_coupons', (select count(*)::int from coupons where is_active = true and used_at is null),
          'pending_lidl', (select count(*)::int from lidl_cards where review_status = 'pending'),
          'pending_dunnes', (select count(*)::int from dunnes_vouchers where review_status = 'pending'),
          'open_lidl_reports', (select count(*)::int from lidl_card_reports where status = 'open'),
          'open_dunnes_reports', (select count(*)::int from dunnes_voucher_reports where status = 'open')
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
        ) as dunnes_today,
        coalesce((select json_agg(row_to_json(items)) from (
          select card.id::text as card_id,
            '공유 카드 · ' || upper(substr(md5(card.owner_id::text || current_date::text), 1, 3)) as card_label,
            card.review_status,
            count(c.id) filter (where c.is_active = true and c.used_at is null)::int as coupon_count,
            to_char(card.updated_at at time zone 'Europe/Dublin', 'DD Mon HH24:MI') as updated_at
          from lidl_cards card
          left join coupons c on c.owner_id = card.owner_id
          group by card.id
          order by (card.review_status = 'pending') desc, card.updated_at desc
          limit 20
        ) items), '[]'::json) as lidl_reviews,
        coalesce((select json_agg(row_to_json(items)) from (
          select id::text as voucher_id,
            case voucher_type when '5off25' then '€5 할인' else '€10 할인' end as voucher_label,
            membership_required, expires_on::text,
            to_char(updated_at at time zone 'Europe/Dublin', 'DD Mon HH24:MI') as updated_at
          from dunnes_vouchers
          where review_status = 'pending'
          order by updated_at asc
          limit 20
        ) items), '[]'::json) as dunnes_reviews,
        coalesce((select json_agg(row_to_json(items)) from (
          select r.card_id::text,
            '공유 카드 · ' || upper(substr(md5(card.owner_id::text || current_date::text), 1, 3)) as card_label,
            r.reason, count(*)::int as report_count,
            to_char(min(r.created_at) at time zone 'Europe/Dublin', 'DD Mon HH24:MI') as created_at
          from lidl_card_reports r
          join lidl_cards card on card.id = r.card_id
          where r.status = 'open'
          group by r.card_id, card.owner_id, r.reason
          order by min(r.created_at) asc
          limit 20
        ) items), '[]'::json) as lidl_reports,
        coalesce((select json_agg(row_to_json(items)) from (
          select min(r.id::text) as report_id, r.voucher_id::text,
            case v.voucher_type when '5off25' then '€5 할인' else '€10 할인' end as voucher_label,
            r.reason, count(*)::int as report_count,
            to_char(min(r.created_at) at time zone 'Europe/Dublin', 'DD Mon HH24:MI') as created_at
          from dunnes_voucher_reports r
          join dunnes_vouchers v on v.id = r.voucher_id
          where r.status = 'open'
          group by r.voucher_id, v.voucher_type, r.reason
          order by min(r.created_at) asc
          limit 20
        ) items), '[]'::json) as dunnes_reports,
        coalesce((select json_agg(row_to_json(items)) from (
          select p.id::text as profile_id,
            '익명 사용자 · ' || upper(substr(md5(p.id::text || current_date::text), 1, 3)) as user_label,
            p.risk_score, p.is_blocked,
            coalesce(u.view_count, 0)::int as today_views,
            coalesce(u.blocked_attempts, 0)::int as blocked_attempts
          from profiles p
          left join qr_daily_usage u on u.profile_id = p.id
            and u.usage_date = (now() at time zone 'Europe/Dublin')::date
          where p.risk_score > 0 or p.is_blocked = true or coalesce(u.blocked_attempts, 0) > 0
          order by p.is_blocked desc, p.risk_score desc, p.updated_at desc
          limit 20
        ) items), '[]'::json) as risks
    `, 9_000);
    if (!loaded) throw new Error("Admin dashboard returned no data.");
    dashboard = loaded;
  } catch {
    dashboardUnavailable = true;
    dashboard = {
      summary: { profiles: 0, shared_cards: 0, active_coupons: 0, pending_lidl: 0, pending_dunnes: 0, open_lidl_reports: 0, open_dunnes_reports: 0 },
      daily: { qr_views: 0, blocked_attempts: 0 },
      dunnes_today: { viewers: 0, views: 0, users: 0, uses: 0 },
      lidl_reviews: [],
      dunnes_reviews: [],
      lidl_reports: [],
      dunnes_reports: [],
      risks: [],
    };
  }
  const {
    summary,
    daily,
    dunnes_today: dunnesToday,
    lidl_reviews: lidlReviews,
    dunnes_reviews: dunnesReviews,
    lidl_reports: lidlReports,
    dunnes_reports: dunnesReports,
    risks,
  } = dashboard;

  const pendingCount = (summary?.pending_lidl ?? 0) + (summary?.pending_dunnes ?? 0) + (summary?.open_lidl_reports ?? 0) + (summary?.open_dunnes_reports ?? 0);
  const stats = [
    { label: "등록 사용자", value: summary?.profiles ?? 0, detail: `공유 카드 ${summary?.shared_cards ?? 0}개` },
    { label: "활성 Lidl 쿠폰", value: summary?.active_coupons ?? 0, detail: "사용 완료 제외" },
    { label: "오늘 QR 열람", value: daily?.qr_views ?? 0, detail: "사용자별 최대 3회" },
    { label: "오늘 Dunnes 열람", value: dunnesToday?.viewers ?? 0, detail: `총 ${dunnesToday?.views ?? 0}회` },
    { label: "오늘 Dunnes 사용", value: dunnesToday?.users ?? 0, detail: `총 ${dunnesToday?.uses ?? 0}건` },
    { label: "검수·위험", value: pendingCount + risks.length, detail: `초과 시도 ${daily?.blocked_attempts ?? 0}회` },
  ];

  return (
    <main className="admin-shell">
      <AdminSessionRefresh />
      <header className="admin-topbar">
        <Link className="brand" href="/" aria-label="CouponShare 메인"><span className="brand-mark">C</span><span>CouponShare Admin</span></Link>
        <div className="admin-topbar-actions"><span className="admin-access-badge">관리자 전용</span><form action="/api/admin/logout" method="post"><button className="admin-logout-button" type="submit">로그아웃</button></form><Link className="admin-back-link" href="/">메인으로</Link></div>
      </header>
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <p>ADMIN MENU</p>
          <nav className="admin-nav" aria-label="관리자 메뉴"><a href="#overview">운영 요약</a><a href="#reviews">업로드 검수</a><a href="#risk">위험 사용자</a><a href="#policy">운영 정책</a></nav>
          <div className="admin-privacy-card"><strong>민감 이미지 보호</strong><span>검수 목록에는 QR·바코드 원본과 실명을 표시하지 않습니다.</span></div>
        </aside>
        <section className="admin-main" id="overview">
          {dashboardUnavailable && <p className="admin-data-warning" role="status">데이터 조회가 지연되고 있습니다. 관리자 메뉴는 이용할 수 있으며, 잠시 후 새로고침해 주세요.</p>}
          <div className="admin-heading">
            <div><p className="eyebrow">LIVE OPERATIONS</p><h1>관리자 대시보드</h1><p>공유 현황, 검수 대기, 제한 초과를 확인합니다.</p></div>
            <span className="admin-date">Ireland · {new Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeZone: "Europe/Dublin" }).format(new Date())}</span>
          </div>
          <div className="admin-stats">{stats.map((stat) => <article className="admin-stat" key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong><small>{stat.detail}</small></article>)}</div>
          <div className="admin-grid">
            <div className="admin-column">
              <section className="admin-panel" id="reviews">
                <header className="admin-panel-head"><h2>Lidl 업로드 검수</h2><span>QR 원본 비노출</span></header>
                <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>익명 카드</th><th>활성 쿠폰</th><th>업데이트</th><th>상태</th></tr></thead><tbody>
                  {lidlReviews.length ? lidlReviews.map((review) => <tr key={review.card_id}><td><strong>{review.card_label}</strong></td><td>{review.coupon_count}개</td><td>{review.updated_at}</td><td><span className={review.review_status === "pending" ? "admin-table-status warn" : review.review_status === "rejected" ? "admin-table-status danger" : "admin-table-status"}>{review.review_status === "pending" ? "검수 필요" : review.review_status === "rejected" ? "거절" : "승인"}</span><form className="admin-inline-actions" action="/api/admin/moderation" method="post"><input type="hidden" name="targetId" value={review.card_id} /><button name="action" value="approve_card" type="submit">승인</button><button className="danger" name="action" value="reject_card" type="submit" title="QR과 연결 쿠폰을 영구 삭제합니다">거절·삭제</button></form></td></tr>) : <tr><td colSpan={4}>검수할 Lidl 업로드가 없습니다.</td></tr>}
                </tbody></table></div>
              </section>
              <section className="admin-panel">
                <header className="admin-panel-head"><h2>Lidl 신고</h2><span>신고 2명부터 자동 숨김</span></header>
                <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>공유 카드</th><th>사유</th><th>신고</th><th>처리</th></tr></thead><tbody>
                  {lidlReports.length ? lidlReports.map((report) => <tr key={`${report.card_id}-${report.reason}`}><td><strong>{report.card_label}</strong><small className="admin-cell-note">{report.created_at}</small></td><td>{report.reason === "invalid_qr" ? "QR이 유효하지 않음" : report.reason === "unrelated_image" ? "Lidl QR과 무관한 이미지" : "활성 쿠폰 내역 불일치"}</td><td>{report.report_count}건</td><td><form className="admin-inline-actions" action="/api/admin/moderation" method="post"><input type="hidden" name="targetId" value={report.card_id} /><button name="action" value="resolve_lidl_reports" type="submit">문제 없음</button><button className="danger" name="action" value="reject_card" type="submit">카드 삭제</button></form></td></tr>) : <tr><td colSpan={4}>열린 신고가 없습니다.</td></tr>}
                </tbody></table></div>
              </section>
              <section className="admin-panel">
                <header className="admin-panel-head"><h2>Dunnes 바우처 검수</h2><span>바코드 원본 비노출</span></header>
                <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>종류</th><th>멤버십</th><th>만료일</th><th>처리</th></tr></thead><tbody>
                  {dunnesReviews.length ? dunnesReviews.map((review) => <tr key={review.voucher_id}><td><strong>{review.voucher_label}</strong><small className="admin-cell-note">{review.updated_at}</small></td><td>{review.membership_required ? "필요" : "불필요"}</td><td>{review.expires_on}</td><td><form className="admin-inline-actions" action="/api/admin/moderation" method="post"><input type="hidden" name="targetId" value={review.voucher_id} /><button name="action" value="approve_dunnes" type="submit">승인</button><button className="danger" name="action" value="reject_dunnes" type="submit" title="바우처를 영구 삭제합니다">거절·삭제</button></form></td></tr>) : <tr><td colSpan={4}>검수할 Dunnes 바우처가 없습니다.</td></tr>}
                </tbody></table></div>
              </section>
              <section className="admin-panel">
                <header className="admin-panel-head"><h2>Dunnes 신고</h2><span>신고 2건부터 자동 재검수</span></header>
                <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>바우처</th><th>사유</th><th>신고</th><th>처리</th></tr></thead><tbody>
                  {dunnesReports.length ? dunnesReports.map((report) => <tr key={`${report.voucher_id}-${report.reason}`}><td><strong>{report.voucher_label}</strong><small className="admin-cell-note">{report.created_at}</small></td><td>{report.reason === "invalid_voucher" ? "유효하지 않음" : "멤버십 스캔 누락"}</td><td>{report.report_count}건</td><td><form className="admin-inline-actions" action="/api/admin/moderation" method="post"><input type="hidden" name="targetId" value={report.voucher_id} /><button name="action" value="resolve_dunnes_reports" type="submit">문제 없음</button><button className="danger" name="action" value="reject_dunnes" type="submit">바우처 삭제</button></form></td></tr>) : <tr><td colSpan={4}>열린 신고가 없습니다.</td></tr>}
                </tbody></table></div>
              </section>
              <section className="admin-panel" id="risk">
                <header className="admin-panel-head"><h2>위험 사용자 감지</h2><span>QR 제한 반복 초과 기준</span></header>
                <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>익명 사용자</th><th>오늘 열람</th><th>초과 시도</th><th>위험 점수</th><th>상태</th></tr></thead><tbody>
                  {risks.length ? risks.map((risk) => <tr key={risk.profile_id}><td><strong>{risk.user_label}</strong></td><td>{risk.today_views}/3</td><td>{risk.blocked_attempts}</td><td>{risk.risk_score}</td><td><span className={risk.is_blocked ? "admin-table-status danger" : "admin-table-status warn"}>{risk.is_blocked ? "차단됨" : "관찰"}</span><form className="admin-inline-actions" action="/api/admin/moderation" method="post"><input type="hidden" name="targetId" value={risk.profile_id} /><button className={risk.is_blocked ? "" : "danger"} name="action" value={risk.is_blocked ? "unblock_user" : "block_user"} type="submit">{risk.is_blocked ? "차단 해제" : "차단"}</button></form></td></tr>) : <tr><td colSpan={5}>현재 감지된 위험 사용자가 없습니다.</td></tr>}
                </tbody></table></div>
              </section>
            </div>
            <div className="admin-column">
              <section className="admin-panel" id="policy">
                <header className="admin-panel-head"><h2>운영 정책</h2><span>서버 적용</span></header>
                <div className="policy-list">
                  <div className="policy-row"><div><strong>Lidl QR 일일 열람</strong><span>아일랜드 날짜 기준</span></div><span className="policy-value">3회</span></div>
                  <div className="policy-row"><div><strong>Dunnes 예약</strong><span>30분 후 자동 해제</span></div><span className="policy-value">3개/일</span></div>
                  <div className="policy-row"><div><strong>신규 Dunnes 업로드</strong><span>관리자 승인 후 공개</span></div><span className="policy-value">2개/일</span></div>
                  <div className="policy-row"><div><strong>비공개 테스트 초대코드</strong><span>ADMIN_PASSWORD 변경 시 자동 교체</span></div><span className="policy-value">{access.accessCode || "미설정"}</span></div>
                  <div className="policy-row"><div><strong>업로드 거절</strong><span>연결 데이터 삭제</span></div><span className="policy-value">즉시</span></div>
                </div>
                <p className="admin-action-note">영수증 원본은 서버에 저장하지 않습니다. QR·바코드 이미지는 검수 목록에서 직접 노출하지 않습니다.</p>
              </section>
            </div>
          </div>
          <footer className="admin-footer">© 2026 Sunmin Lee. 관리자 전용 화면.</footer>
        </section>
      </div>
    </main>
  );
}

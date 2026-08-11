import type { Metadata } from "next";
import Link from "next/link";
import { getSqlClient } from "@/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CouponShare Admin",
  description: "CouponShare 검수, QR 열람 제한 및 위험 사용자 관리",
};

type Summary = {
  profiles: number;
  shared_cards: number;
  active_coupons: number;
  pending_reviews: number;
};

type DailyUsage = {
  qr_views: number;
  blocked_attempts: number;
};

type ReviewRow = {
  card_id: string;
  card_label: string;
  review_status: "pending" | "approved" | "rejected";
  coupon_count: number;
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

export default async function AdminPage() {
  const sql = getSqlClient();
  const [[summary], [daily], reviews, risks] = await Promise.all([
    sql<Summary[]>`
      select
        (select count(*)::int from profiles) as profiles,
        (select count(*)::int from lidl_cards where is_shared = true and review_status <> 'rejected') as shared_cards,
        (select count(*)::int from coupons where is_active = true and used_at is null) as active_coupons,
        (select count(*)::int from lidl_cards where review_status = 'pending') as pending_reviews
    `,
    sql<DailyUsage[]>`
      select
        coalesce(sum(view_count), 0)::int as qr_views,
        coalesce(sum(blocked_attempts), 0)::int as blocked_attempts
      from qr_daily_usage
      where usage_date = (now() at time zone 'Europe/Dublin')::date
    `,
    sql<ReviewRow[]>`
      select
        card.id::text as card_id,
        '공유 카드 · ' || upper(substr(md5(card.owner_id::text || current_date::text), 1, 3)) as card_label,
        card.review_status,
        count(c.id) filter (where c.is_active = true and c.used_at is null)::int as coupon_count,
        to_char(card.updated_at at time zone 'Europe/Dublin', 'DD Mon HH24:MI') as updated_at
      from lidl_cards card
      left join coupons c on c.owner_id = card.owner_id
      group by card.id
      order by (card.review_status = 'pending') desc, card.updated_at desc
      limit 20
    `,
    sql<RiskRow[]>`
      select
        p.id::text as profile_id,
        '익명 사용자 · ' || upper(substr(md5(p.id::text || current_date::text), 1, 3)) as user_label,
        p.risk_score,
        p.is_blocked,
        coalesce(u.view_count, 0)::int as today_views,
        coalesce(u.blocked_attempts, 0)::int as blocked_attempts
      from profiles p
      left join qr_daily_usage u on u.profile_id = p.id
        and u.usage_date = (now() at time zone 'Europe/Dublin')::date
      where p.risk_score > 0 or p.is_blocked = true or coalesce(u.blocked_attempts, 0) > 0
      order by p.is_blocked desc, p.risk_score desc, p.updated_at desc
      limit 20
    `,
  ]);

  const stats = [
    { label: "등록 사용자", value: summary?.profiles ?? 0, detail: `공유 카드 ${summary?.shared_cards ?? 0}개` },
    { label: "활성 쿠폰", value: summary?.active_coupons ?? 0, detail: "사용 완료 제외" },
    { label: "오늘 QR 열람", value: daily?.qr_views ?? 0, detail: "사용자별 최대 3회" },
    { label: "검수·위험", value: (summary?.pending_reviews ?? 0) + risks.length, detail: `초과 시도 ${daily?.blocked_attempts ?? 0}회` },
  ];

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <Link className="brand" href="/" aria-label="CouponShare 홈"><span className="brand-mark">C</span><span>CouponShare Admin</span></Link>
        <div className="admin-topbar-actions"><span className="admin-access-badge">Owner-only access</span><Link className="admin-back-link" href="/">서비스 화면</Link></div>
      </header>

      <div className="admin-layout">
        <aside className="admin-sidebar">
          <p>ADMIN MENU</p>
          <nav className="admin-nav" aria-label="관리자 메뉴"><a href="#overview">운영 요약</a><a href="#reviews">사진 검수</a><a href="#risk">위험 사용자</a><a href="#policy">운영 정책</a></nav>
          <div className="admin-privacy-card"><strong>QR 원본 보호</strong><span>검수 목록에는 QR 이미지와 실제 사용자 이름을 표시하지 않습니다.</span></div>
        </aside>

        <section className="admin-main" id="overview">
          <div className="admin-heading">
            <div><p className="eyebrow">LIVE OPERATIONS</p><h1>관리자 대시보드</h1><p>실제 공유 현황, 검수 대기 및 QR 제한 초과를 확인합니다.</p></div>
            <span className="admin-date">Ireland · {new Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeZone: "Europe/Dublin" }).format(new Date())}</span>
          </div>

          <div className="admin-stats">{stats.map((stat) => <article className="admin-stat" key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong><small>{stat.detail}</small></article>)}</div>

          <div className="admin-grid">
            <div className="admin-column">
              <section className="admin-panel" id="reviews">
                <header className="admin-panel-head"><h2>업로드 검수 목록</h2><span>QR 원본·실명 비노출</span></header>
                <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>익명 카드</th><th>활성 쿠폰</th><th>업로드 시각</th><th>상태</th></tr></thead><tbody>
                  {reviews.length ? reviews.map((review) => <tr key={`${review.card_label}-${review.updated_at}`}><td><strong>{review.card_label}</strong></td><td>{review.coupon_count}개</td><td>{review.updated_at}</td><td><span className={review.review_status === "pending" ? "admin-table-status warn" : review.review_status === "rejected" ? "admin-table-status danger" : "admin-table-status"}>{review.review_status === "pending" ? "검수 필요" : review.review_status === "rejected" ? "거절" : "승인"}</span><form className="admin-inline-actions" action="/api/admin/moderation" method="post"><input type="hidden" name="targetId" value={review.card_id} /><button name="action" value="approve_card" type="submit">승인</button><button className="danger" name="action" value="reject_card" type="submit" title="QR과 연결 쿠폰을 영구 삭제합니다">거절·삭제</button></form></td></tr>) : <tr><td colSpan={4}>검수할 업로드가 없습니다.</td></tr>}
                </tbody></table></div>
              </section>

              <section className="admin-panel" id="risk">
                <header className="admin-panel-head"><h2>위험 사용자 감지</h2><span>QR 제한 반복 초과 기준</span></header>
                <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>익명 사용자</th><th>오늘 열람</th><th>초과 시도</th><th>위험 점수</th><th>상태</th></tr></thead><tbody>
                  {risks.length ? risks.map((risk) => <tr key={risk.user_label}><td><strong>{risk.user_label}</strong></td><td>{risk.today_views}/3</td><td>{risk.blocked_attempts}</td><td>{risk.risk_score}</td><td><span className={risk.is_blocked ? "admin-table-status danger" : "admin-table-status warn"}>{risk.is_blocked ? "차단됨" : "관찰"}</span><form className="admin-inline-actions" action="/api/admin/moderation" method="post"><input type="hidden" name="targetId" value={risk.profile_id} /><button className={risk.is_blocked ? "" : "danger"} name="action" value={risk.is_blocked ? "unblock_user" : "block_user"} type="submit">{risk.is_blocked ? "차단 해제" : "차단"}</button></form></td></tr>) : <tr><td colSpan={5}>현재 감지된 위험 사용자가 없습니다.</td></tr>}
                </tbody></table></div>
              </section>
            </div>

            <div className="admin-column">
              <section className="admin-panel" id="policy">
                <header className="admin-panel-head"><h2>현재 운영 정책</h2><span>서버 강제 적용</span></header>
                <div className="policy-list">
                  <div className="policy-row"><div><strong>QR 일일 열람</strong><span>아일랜드 날짜 기준</span></div><span className="policy-value">3회</span></div>
                  <div className="policy-row"><div><strong>공유 QR 노출</strong><span>화면 전환 시 즉시 숨김</span></div><span className="policy-value">30초</span></div>
                  <div className="policy-row"><div><strong>자동 위험 점수</strong><span>제한 후 추가 클릭</span></div><span className="policy-value">+1</span></div>
                  <div className="policy-row"><div><strong>자동 차단</strong><span>반복적인 제한 우회 시도</span></div><span className="policy-value">10점</span></div>
                  <div className="policy-row"><div><strong>업로드 거절</strong><span>QR과 연결 쿠폰 삭제</span></div><span className="policy-value">즉시</span></div>
                  <div className="policy-row"><div><strong>사진 원본</strong><span>영수증은 기기 내 OCR</span></div><span className="policy-value">미저장</span></div>
                </div>
                <p className="admin-action-note">영수증 원본은 비용·개인정보 보호를 위해 서버에 저장하지 않습니다. QR 업로드는 검수 상태와 익명 카드 정보만 관리자 목록에 표시합니다.</p>
              </section>
            </div>
          </div>

          <footer className="admin-footer">© 2026 Sunmin Lee. CouponShare 관리자 전용 화면.</footer>
        </section>
      </div>
    </main>
  );
}

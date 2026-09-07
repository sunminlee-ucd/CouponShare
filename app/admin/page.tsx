import type { Metadata } from "next";
import AdminDashboardSummary from "@/app/admin/AdminDashboardSummary";
import AdminSectionFrame from "@/app/admin/AdminSectionFrame";
import { requireAdminPage } from "@/app/admin/require-page-session";
import { LIDL_ENABLED } from "@/app/features";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CouponShare Admin",
  description: "CouponShare 운영 요약",
};

export default async function AdminPage() {
  await requireAdminPage("/admin");

  return (
    <AdminSectionFrame>
      <section className="admin-main" id="overview">
        <div className="admin-heading">
          <div>
            <p className="eyebrow">LIVE OPERATIONS</p>
            <h1>관리자 대시보드</h1>
            <p>화면은 즉시 열리고 운영 요약은 백그라운드에서 불러옵니다. 세부 데이터는 각 메뉴를 열 때 조회합니다.</p>
          </div>
          <span className="admin-date">
            Ireland · {new Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeZone: "Europe/Dublin" }).format(new Date())}
          </span>
        </div>

        <AdminDashboardSummary />

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

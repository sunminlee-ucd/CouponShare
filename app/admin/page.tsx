import type { Metadata } from "next";
import Link from "next/link";
import { requireChatGPTUser } from "../chatgpt-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CouponShare Admin",
  description: "CouponShare 운영 및 개인정보 보호 관리 페이지",
};

const stats = [
  { label: "그룹 카드", value: "3", detail: "공유 중 2개" },
  { label: "활성 쿠폰", value: "13", detail: "이번 주 +4" },
  { label: "오늘 QR 열람", value: "12", detail: "자동 숨김 3회" },
  { label: "신고·차단", value: "0", detail: "정상 운영 중" },
];

const couponChecks = [
  { card: "공유 카드 · 7K2", item: "Fresh Onions", issue: "10 Aug 만료 예정", status: "확인 필요", warn: true },
  { card: "공유 카드 · 4QP", item: "Ground Coffee", issue: "OCR 정보 일치", status: "정상", warn: false },
  { card: "내 카드", item: "Wholemeal Bread", issue: "중복 쿠폰 최고액 선택", status: "자동 처리", warn: false },
];

const audits = [
  { event: "QR 열람 후 결과 확인", detail: "익명 세션 · 14:42 · 12초 제한 적용" },
  { event: "화면 전환으로 QR 자동 숨김", detail: "익명 세션 · 13:18 · 복사 시도 정보 저장 안 함" },
  { event: "쿠폰 검색", detail: "검색어 milk · 12:55 · 개인정보 기록 없음" },
];

export default async function AdminPage() {
  await requireChatGPTUser("/admin");

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <Link className="brand" href="/" aria-label="CouponShare 홈">
          <span className="brand-mark">C</span><span>CouponShare Admin</span>
        </Link>
        <div className="admin-topbar-actions">
          <span className="admin-access-badge">Owner-only access</span>
          <Link className="admin-back-link" href="/">서비스 화면</Link>
        </div>
      </header>

      <div className="admin-layout">
        <aside className="admin-sidebar">
          <p>ADMIN MENU</p>
          <nav className="admin-nav" aria-label="관리자 메뉴">
            <a href="#overview">운영 요약</a>
            <a href="#coupons">쿠폰 검수</a>
            <a href="#privacy">개인정보 보호</a>
            <a href="#audit">열람 기록</a>
          </nav>
          <div className="admin-privacy-card">
            <strong>QR 원본 비노출</strong>
            <span>관리자 화면에서도 QR 이미지와 실제 소유자 이름을 표시하지 않습니다.</span>
          </div>
        </aside>

        <section className="admin-main" id="overview">
          <div className="admin-heading">
            <div><p className="eyebrow">OPERATIONS</p><h1>관리자 대시보드</h1><p>서비스 상태와 익명 공유 정책을 한눈에 확인합니다.</p></div>
            <span className="admin-date">Ireland · 07 Aug 2026</span>
          </div>

          <div className="admin-stats">
            {stats.map((stat) => <article className="admin-stat" key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong><small>{stat.detail}</small></article>)}
          </div>

          <div className="admin-grid">
            <div className="admin-column">
              <section className="admin-panel" id="coupons">
                <header className="admin-panel-head"><h2>쿠폰 검수</h2><span>소유자 식별정보 제외</span></header>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>카드 표식</th><th>상품</th><th>검수 내용</th><th>상태</th></tr></thead>
                    <tbody>{couponChecks.map((check) => <tr key={`${check.card}-${check.item}`}><td><strong>{check.card}</strong></td><td>{check.item}</td><td>{check.issue}</td><td><span className={check.warn ? "admin-table-status warn" : "admin-table-status"}>{check.status}</span></td></tr>)}</tbody>
                  </table>
                </div>
              </section>

              <section className="admin-panel" id="audit">
                <header className="admin-panel-head"><h2>익명 열람 기록</h2><span>QR 값·실명 저장 안 함</span></header>
                <div className="audit-list">{audits.map((audit) => <div className="audit-item" key={audit.detail}><strong>{audit.event}</strong><span>{audit.detail}</span></div>)}</div>
              </section>
            </div>

            <div className="admin-column">
              <section className="admin-panel" id="privacy">
                <header className="admin-panel-head"><h2>운영 정책</h2><span>현재 적용값</span></header>
                <div className="policy-list">
                  <div className="policy-row"><div><strong>포인트 환산</strong><span>순이득 계산 기준</span></div><span className="policy-value">1pt = €0.01</span></div>
                  <div className="policy-row"><div><strong>QR 노출 시간</strong><span>이후 자동 숨김</span></div><span className="policy-value">12초</span></div>
                  <div className="policy-row"><div><strong>사용자 표식</strong><span>전체 ID 대신 끝자리만</span></div><span className="policy-value">3자리</span></div>
                  <div className="policy-row"><div><strong>소유자 정보</strong><span>사용자·관리자 화면</span></div><span className="policy-value">숨김</span></div>
                </div>
                <p className="admin-action-note">현재는 읽기 전용 미리보기입니다. 정책 변경과 검수 처리는 관리자 데이터 저장소를 연결한 뒤 활성화됩니다.</p>
              </section>
            </div>
          </div>

          <footer className="admin-footer">© 2026 Sunmin Lee. CouponShare 관리자 전용 화면.</footer>
        </section>
      </div>
    </main>
  );
}

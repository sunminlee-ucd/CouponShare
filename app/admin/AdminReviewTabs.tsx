"use client";

import { lazy, Suspense, type ReactNode, useState } from "react";

const AdminDunnesReviewQueue = lazy(() => import("@/app/admin/AdminDunnesReviewQueue"));
const AdminDunnesReservationStatus = lazy(() => import("@/app/admin/AdminDunnesReservationStatus"));
const AdminDunnesUsageSummary = lazy(() => import("@/app/admin/AdminDunnesUsageSummary"));

type ReviewStore = "dunnes" | "lidl";
type DunnesSection = "overview" | "registered" | "reservations" | "review";

type AdminReviewTabsProps = {
  dunnes: ReactNode;
  dunnesCount: number;
  lidl: ReactNode;
  lidlCount: number;
  lidlEnabled: boolean;
};

const dunnesSections: Array<{ id: DunnesSection; label: string }> = [
  { id: "overview", label: "현황" },
  { id: "registered", label: "등록 바우처" },
  { id: "reservations", label: "예약 중" },
  { id: "review", label: "검수·신고" },
];

function LoadingPanel() {
  return <p className="admin-action-note" role="status">선택한 관리자 데이터를 불러오는 중입니다.</p>;
}

function DunnesPanel({ children }: { children: ReactNode }) {
  const [activeSection, setActiveSection] = useState<DunnesSection>("overview");

  return (
    <div className="admin-review-panel-list">
      <div className="admin-secondary-tabs" role="tablist" aria-label="Dunnes 관리 세부 메뉴">
        {dunnesSections.map((section) => {
          const active = activeSection === section.id;
          return (
            <button
              aria-controls={`admin-dunnes-section-${section.id}`}
              aria-selected={active}
              className={active ? "active" : ""}
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              role="tab"
              type="button"
            >
              {section.label}
            </button>
          );
        })}
      </div>

      <div
        className="admin-secondary-panel"
        id={`admin-dunnes-section-${activeSection}`}
        role="tabpanel"
      >
        <Suspense fallback={<LoadingPanel />}>
          {activeSection === "overview" && <AdminDunnesUsageSummary />}
          {activeSection === "registered" && <AdminDunnesReviewQueue />}
          {activeSection === "reservations" && <AdminDunnesReservationStatus />}
          {activeSection === "review" && <div className="admin-review-panel-list">{children}</div>}
        </Suspense>
      </div>
    </div>
  );
}

export default function AdminReviewTabs({ dunnes, dunnesCount, lidl, lidlCount, lidlEnabled }: AdminReviewTabsProps) {
  const [activeStore, setActiveStore] = useState<ReviewStore>("dunnes");
  const isDunnes = activeStore === "dunnes";

  if (!lidlEnabled) {
    return <section className="admin-review-tabs" id="reviews"><DunnesPanel>{dunnes}</DunnesPanel></section>;
  }

  return (
    <section className="admin-review-tabs" id="reviews">
      <div className="admin-review-tablist" role="tablist" aria-label="매장별 검수">
        <button
          aria-controls="admin-review-panel"
          aria-selected={isDunnes}
          className={isDunnes ? "active" : ""}
          id="admin-review-tab-dunnes"
          onClick={() => setActiveStore("dunnes")}
          role="tab"
          type="button"
        >
          Dunnes <span>{dunnesCount}</span>
        </button>
        <button
          aria-controls="admin-review-panel"
          aria-selected={!isDunnes}
          className={!isDunnes ? "active" : ""}
          id="admin-review-tab-lidl"
          onClick={() => setActiveStore("lidl")}
          role="tab"
          type="button"
        >
          Lidl <span>{lidlCount}</span>
        </button>
      </div>
      <div
        aria-labelledby={isDunnes ? "admin-review-tab-dunnes" : "admin-review-tab-lidl"}
        id="admin-review-panel"
        role="tabpanel"
      >
        {isDunnes ? <DunnesPanel>{dunnes}</DunnesPanel> : <div className="admin-review-panel-list">{lidl}</div>}
      </div>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";

type AdminTab = "dashboard" | "users" | "vouchers" | "reports" | "infrastructure";

const tabs: Array<{ id: AdminTab; label: string; description: string }> = [
  { id: "dashboard", label: "Dashboard", description: "운영 요약" },
  { id: "users", label: "Users", description: "사용자 관리" },
  { id: "vouchers", label: "Vouchers", description: "검수·바우처" },
  { id: "reports", label: "Reports", description: "오류 신고" },
  { id: "infrastructure", label: "Infrastructure", description: "용량·비용" },
];

function tabFromHash(hash: string): AdminTab {
  const value = hash.replace(/^#admin-/, "");
  return tabs.some((tab) => tab.id === value) ? value as AdminTab : "dashboard";
}

export default function AdminPrimaryTabs() {
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.location.pathname !== "/admin") {
      delete document.body.dataset.adminPrimaryTab;
      return;
    }

    setVisible(true);
    const syncFromLocation = () => {
      const nextTab = tabFromHash(window.location.hash);
      setActiveTab(nextTab);
      document.body.dataset.adminPrimaryTab = nextTab;
    };

    syncFromLocation();
    window.addEventListener("hashchange", syncFromLocation);
    return () => {
      window.removeEventListener("hashchange", syncFromLocation);
      delete document.body.dataset.adminPrimaryTab;
    };
  }, []);

  function selectTab(tab: AdminTab) {
    setActiveTab(tab);
    document.body.dataset.adminPrimaryTab = tab;
    const target = `${window.location.pathname}${window.location.search}#admin-${tab}`;
    window.history.replaceState({}, "", target);
  }

  if (!visible) return null;

  return (
    <nav className="admin-primary-tabs" aria-label="관리자 주요 메뉴">
      <div className="admin-primary-tabs-inner" role="tablist" aria-label="Admin sections">
        {tabs.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <button
              aria-selected={active}
              className={`admin-primary-tab${active ? " active" : ""}`}
              key={tab.id}
              onClick={() => selectTab(tab.id)}
              role="tab"
              type="button"
            >
              <strong>{tab.label}</strong>
              <small>{tab.description}</small>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

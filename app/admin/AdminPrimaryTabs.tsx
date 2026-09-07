"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type AdminTab = "dashboard" | "users" | "vouchers" | "reports" | "infrastructure" | "maintenance";

const tabs: Array<{ id: AdminTab; label: string; description: string }> = [
  { id: "dashboard", label: "Dashboard", description: "운영 요약" },
  { id: "users", label: "Users", description: "사용자 관리" },
  { id: "vouchers", label: "Vouchers", description: "검수·바우처" },
  { id: "reports", label: "Reports", description: "오류 신고" },
  { id: "infrastructure", label: "Infrastructure", description: "용량·비용" },
  { id: "maintenance", label: "Maintenance", description: "접근 점검" },
];

function tabFromHash(hash: string): AdminTab {
  const value = hash.replace(/^#admin-/, "");
  return value === "vouchers" || value === "reports" ? value : "dashboard";
}

function tabFromPathname(pathname: string): AdminTab | null {
  if (pathname.startsWith("/admin/users")) return "users";
  if (pathname.startsWith("/admin/infrastructure")) return "infrastructure";
  if (pathname.startsWith("/admin/maintenance")) return "maintenance";
  return null;
}

function applyBodyTab(tab: AdminTab) {
  document.body.setAttribute("data-admin-primary-tab", tab);
}

export default function AdminPrimaryTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>(() => tabFromPathname(pathname) ?? "dashboard");

  useEffect(() => {
    const syncFromLocation = () => {
      const nextTab = tabFromPathname(pathname) ?? tabFromHash(window.location.hash);
      setActiveTab(nextTab);
      applyBodyTab(nextTab);
    };

    syncFromLocation();
    if (pathname === "/admin") window.addEventListener("hashchange", syncFromLocation);
    return () => {
      if (pathname === "/admin") window.removeEventListener("hashchange", syncFromLocation);
      document.body.removeAttribute("data-admin-primary-tab");
    };
  }, [pathname]);

  function selectTab(tab: AdminTab) {
    if (tab === "users" || tab === "infrastructure" || tab === "maintenance") {
      router.push(`/admin/${tab}`);
      return;
    }

    const hash = tab === "dashboard" ? "" : `#admin-${tab}`;
    if (pathname !== "/admin") {
      router.push(`/admin${hash}`);
      return;
    }

    setActiveTab(tab);
    applyBodyTab(tab);
    window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}${hash}`);
  }

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

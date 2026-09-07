"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

type AdminTab = "dashboard" | "users" | "vouchers" | "reports" | "infrastructure" | "maintenance";

const tabs: Array<{ id: AdminTab; label: string; description: string; href: string }> = [
  { id: "dashboard", label: "Dashboard", description: "운영 요약", href: "/admin" },
  { id: "users", label: "Users", description: "사용자 관리", href: "/admin/users" },
  { id: "vouchers", label: "Vouchers", description: "검수·바우처", href: "/admin/vouchers" },
  { id: "reports", label: "Reports", description: "오류 신고", href: "/admin/reports" },
  { id: "infrastructure", label: "Infrastructure", description: "용량·비용", href: "/admin/infrastructure" },
  { id: "maintenance", label: "Maintenance", description: "접근 점검", href: "/admin/maintenance" },
];

function tabFromPathname(pathname: string): AdminTab {
  if (pathname.startsWith("/admin/users")) return "users";
  if (pathname.startsWith("/admin/vouchers")) return "vouchers";
  if (pathname.startsWith("/admin/reports")) return "reports";
  if (pathname.startsWith("/admin/infrastructure")) return "infrastructure";
  if (pathname.startsWith("/admin/maintenance")) return "maintenance";
  return "dashboard";
}

export default function AdminPrimaryTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const activeTab = tabFromPathname(pathname);

  useEffect(() => {
    document.body.setAttribute("data-admin-primary-tab", activeTab);
    return () => document.body.removeAttribute("data-admin-primary-tab");
  }, [activeTab]);

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
              onClick={() => {
                if (!active) router.push(tab.href);
              }}
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

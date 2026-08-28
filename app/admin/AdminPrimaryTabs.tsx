"use client";

import { useEffect, useState } from "react";

type AdminTab = "dashboard" | "users" | "vouchers" | "reports" | "infrastructure" | "maintenance";

const tabs: Array<{ id: AdminTab; label: string; description: string }> = [
  { id: "dashboard", label: "Dashboard", description: "\uC6B4\uC601 \uC694\uC57D" },
  { id: "users", label: "Users", description: "\uC0AC\uC6A9\uC790 \uAD00\uB9AC" },
  { id: "vouchers", label: "Vouchers", description: "\uAC80\uC218\u00B7\uBC14\uC6B0\uCC98" },
  { id: "reports", label: "Reports", description: "\uC624\uB958 \uC2E0\uACE0" },
  { id: "infrastructure", label: "Infrastructure", description: "\uC6A9\uB7C9\u00B7\uBE44\uC6A9" },
  { id: "maintenance", label: "Maintenance", description: "\uC811\uADFC \uC810\uAC80" },
];

function tabFromHash(hash: string): AdminTab {
  const value = hash.replace(/^#admin-/, "");
  return tabs.some((tab) => tab.id === value) ? value as AdminTab : "dashboard";
}

function applyBodyTab(tab: AdminTab) {
  document.body.setAttribute("data-admin-primary-tab", tab);
}

export default function AdminPrimaryTabs() {
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.location.pathname !== "/admin") {
      document.body.removeAttribute("data-admin-primary-tab");
      return;
    }

    let cancelled = false;
    const syncFromLocation = () => {
      const nextTab = tabFromHash(window.location.hash);
      setActiveTab(nextTab);
      applyBodyTab(nextTab);
    };

    const frame = window.requestAnimationFrame(() => {
      if (cancelled) return;
      setVisible(true);
      syncFromLocation();
    });
    window.addEventListener("hashchange", syncFromLocation);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", syncFromLocation);
      document.body.removeAttribute("data-admin-primary-tab");
    };
  }, []);

  function selectTab(tab: AdminTab) {
    setActiveTab(tab);
    applyBodyTab(tab);
    const target = `${window.location.pathname}${window.location.search}#admin-${tab}`;
    window.history.replaceState({}, "", target);
  }

  if (!visible) return null;

  return (
    <nav className="admin-primary-tabs" aria-label={"\uAD00\uB9AC\uC790 \uC8FC\uC694 \uBA54\uB274"}>
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

"use client";

import { type ReactNode, useState } from "react";

type UserSection = "activity" | "accounts";

type AdminUsersTabsProps = {
  activity: ReactNode;
  accounts: ReactNode;
};

const sections: Array<{ id: UserSection; label: string }> = [
  { id: "activity", label: "활동" },
  { id: "accounts", label: "계정" },
];

export default function AdminUsersTabs({ activity, accounts }: AdminUsersTabsProps) {
  const [activeSection, setActiveSection] = useState<UserSection>("activity");

  return (
    <div className="admin-users-tabs-shell">
      <div className="admin-secondary-tabs" role="tablist" aria-label="사용자 관리 세부 메뉴">
        {sections.map((section) => {
          const active = activeSection === section.id;
          return (
            <button
              aria-controls={`admin-users-section-${section.id}`}
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
      <div className="admin-secondary-panel" id={`admin-users-section-${activeSection}`} role="tabpanel">
        {activeSection === "activity" ? activity : accounts}
      </div>
    </div>
  );
}

"use client";

import { type ReactNode } from "react";
import { useRouter } from "next/navigation";

type UserSection = "activity" | "accounts";

type AdminUsersTabsProps = {
  activeSection?: UserSection;
  activity?: ReactNode;
  accounts?: ReactNode;
};

const sections: Array<{ id: UserSection; label: string; href: string }> = [
  { id: "activity", label: "활동", href: "/admin/users" },
  { id: "accounts", label: "계정", href: "/admin/users/accounts" },
];

export default function AdminUsersTabs({ activeSection = "activity", activity, accounts }: AdminUsersTabsProps) {
  const router = useRouter();

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
              onClick={() => {
                if (!active) router.push(section.href);
              }}
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

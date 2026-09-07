import AdminAccountUsersPanel from "@/app/admin/AdminAccountUsersPanel";
import AdminSectionFrame from "@/app/admin/AdminSectionFrame";
import AdminUsersTabs from "@/app/admin/AdminUsersTabs";
import { requireAdminPage } from "@/app/admin/require-page-session";

export const dynamic = "force-dynamic";

export default async function AdminUserAccountsPage() {
  await requireAdminPage("/admin/users/accounts");

  return (
    <AdminSectionFrame>
      <div className="admin-account-users-slot">
        <AdminUsersTabs activeSection="accounts" accounts={<AdminAccountUsersPanel />} />
      </div>
    </AdminSectionFrame>
  );
}

import AdminSectionFrame from "@/app/admin/AdminSectionFrame";
import AdminUserActivityPanel from "@/app/admin/AdminUserActivityPanel";
import AdminUsersTabs from "@/app/admin/AdminUsersTabs";
import { requireAdminPage } from "@/app/admin/require-page-session";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireAdminPage("/admin/users");

  return (
    <AdminSectionFrame>
      <div className="admin-account-users-slot">
        <AdminUsersTabs activeSection="activity" activity={<AdminUserActivityPanel />} />
      </div>
    </AdminSectionFrame>
  );
}

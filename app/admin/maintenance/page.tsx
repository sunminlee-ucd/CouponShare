import AdminMaintenancePanel from "@/app/admin/AdminMaintenancePanel";
import AdminSectionFrame from "@/app/admin/AdminSectionFrame";
import { requireAdminPage } from "@/app/admin/require-page-session";

export const dynamic = "force-dynamic";

export default async function AdminMaintenancePage() {
  await requireAdminPage("/admin/maintenance");

  return (
    <AdminSectionFrame>
      <div className="admin-maintenance-slot">
        <AdminMaintenancePanel />
      </div>
    </AdminSectionFrame>
  );
}

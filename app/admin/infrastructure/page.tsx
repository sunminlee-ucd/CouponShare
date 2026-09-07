import AdminInfrastructurePanel from "@/app/admin/AdminInfrastructurePanel";
import AdminSectionFrame from "@/app/admin/AdminSectionFrame";
import { requireAdminPage } from "@/app/admin/require-page-session";

export const dynamic = "force-dynamic";

export default async function AdminInfrastructurePage() {
  await requireAdminPage("/admin/infrastructure");

  return (
    <AdminSectionFrame>
      <div className="admin-infrastructure-slot">
        <AdminInfrastructurePanel />
      </div>
    </AdminSectionFrame>
  );
}

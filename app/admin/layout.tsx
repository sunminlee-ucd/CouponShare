import AdminInfrastructurePanel from "./AdminInfrastructurePanel";
import AdminPrimaryTabs from "./AdminPrimaryTabs";
import AdminAccountUsersPanel from "./AdminAccountUsersPanel";
import AdminMaintenancePanel from "./AdminMaintenancePanel";
import "./AdminPrimaryTabs.css";
import "./AdminAccountUsers.css";
import "./AdminMaintenance.css";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <AdminPrimaryTabs />
      {children}
      <div className="admin-account-users-slot">
        <AdminAccountUsersPanel />
      </div>
      <div className="admin-infrastructure-slot">
        <AdminInfrastructurePanel />
      </div>
      <div className="admin-maintenance-slot">
        <AdminMaintenancePanel />
      </div>
    </>
  );
}

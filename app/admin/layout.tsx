import AdminInfrastructurePanel from "./AdminInfrastructurePanel";
import AdminPrimaryTabs from "./AdminPrimaryTabs";
import AdminAccountUsersPanel from "./AdminAccountUsersPanel";
import AdminMaintenancePanel from "./AdminMaintenancePanel";
import AdminUserActivityPanel from "./AdminUserActivityPanel";
import AdminUsersTabs from "./AdminUsersTabs";
import "./AdminPrimaryTabs.css";
import "./AdminAccountUsers.css";
import "./AdminMaintenance.css";
import "./AdminUserActivity.css";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <AdminPrimaryTabs />
      {children}
      <div className="admin-account-users-slot">
        <AdminUsersTabs
          activity={<AdminUserActivityPanel />}
          accounts={<AdminAccountUsersPanel />}
        />
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

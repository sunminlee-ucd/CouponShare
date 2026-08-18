import AdminInfrastructurePanel from "./AdminInfrastructurePanel";
import AdminPrimaryTabs from "./AdminPrimaryTabs";
import "./AdminPrimaryTabs.css";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <AdminPrimaryTabs />
      {children}
      <div className="admin-infrastructure-slot">
        <AdminInfrastructurePanel />
      </div>
    </>
  );
}

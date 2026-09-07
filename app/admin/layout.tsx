import AdminPrimaryTabs from "./AdminPrimaryTabs";
import "./AdminPrimaryTabs.css";
import "./AdminAccountUsers.css";
import "./AdminMaintenance.css";
import "./AdminUserActivity.css";
import "./AdminMobile.css";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <AdminPrimaryTabs />
      {children}
    </>
  );
}

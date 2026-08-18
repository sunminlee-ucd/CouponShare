import AdminInfrastructurePanel from "./AdminInfrastructurePanel";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}<AdminInfrastructurePanel /></>;
}

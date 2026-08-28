import { redirect } from "next/navigation";
import { readMaintenanceStatus } from "@/app/maintenance-mode";
import MaintenanceStatusClient from "./MaintenanceStatusClient";

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const status = await readMaintenanceStatus({ fresh: true });
  if (!status.enabled) redirect("/login");
  return <MaintenanceStatusClient initialStatus={status} />;
}

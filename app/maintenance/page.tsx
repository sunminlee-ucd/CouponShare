import { redirect } from "next/navigation";
import { readMaintenanceMode } from "@/app/maintenance-mode";
import MaintenanceStatusClient from "./MaintenanceStatusClient";

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const enabled = await readMaintenanceMode({ fresh: true });
  if (!enabled) redirect("/login");
  return <MaintenanceStatusClient />;
}

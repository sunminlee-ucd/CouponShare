import { readMaintenanceStatus } from "@/app/maintenance-mode";

export const runtime = "nodejs";

export async function GET() {
  const status = await readMaintenanceStatus();
  return Response.json(
    status,
    {
      headers: {
        "cache-control": "no-store",
        "retry-after": status.enabled ? "10" : "0",
      },
    },
  );
}

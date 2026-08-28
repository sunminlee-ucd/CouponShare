import { readMaintenanceMode } from "@/app/maintenance-mode";

export const runtime = "nodejs";

export async function GET() {
  const enabled = await readMaintenanceMode();
  return Response.json(
    { enabled },
    {
      headers: {
        "cache-control": "no-store",
        "retry-after": enabled ? "10" : "0",
      },
    },
  );
}

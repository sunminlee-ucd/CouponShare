import { getSqlClient } from "@/db";
import { dispatchPendingNotifications } from "@/app/notifications/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = request.headers.get("x-couponshare-notification-token") ?? "";
  if (!token || token.length > 256) return Response.json({ error: "forbidden" }, { status: 403 });

  try {
    const sql = getSqlClient();
    const [allowed] = await sql<{ allowed: boolean }[]>`
      select true as allowed
      from private.notification_dispatch_config
      where singleton = true
        and dispatch_token = ${token}
      limit 1
    `;
    if (!allowed?.allowed) return Response.json({ error: "forbidden" }, { status: 403 });

    const dispatched = await dispatchPendingNotifications();
    return Response.json({ ok: true, dispatched }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Notification dispatch failed", error);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}

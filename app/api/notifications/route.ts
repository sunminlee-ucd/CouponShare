import { authenticatedRequestProfile } from "@/app/auth/request-profile";
import { requestHasSameOrigin } from "@/app/auth/session";
import { getSqlClient } from "@/db";
import type { NotificationType, VoucherType } from "@/app/notifications/copy";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type NotificationRow = {
  id: string;
  notification_type: NotificationType;
  voucher_id: string;
  voucher_type: VoucherType;
  read_at: string | null;
  created_at: string;
};

export async function GET(request: Request) {
  const profile = await authenticatedRequestProfile(request);
  if (!profile) return Response.json({ error: "auth_required" }, { status: 401 });
  if (profile.isBlocked) return Response.json({ error: "unavailable" }, { status: 404 });

  try {
    const sql = getSqlClient();
    const [notifications, unreadRows] = await Promise.all([
      sql<NotificationRow[]>`
        select
          n.id::text,
          n.notification_type,
          n.voucher_id::text,
          v.voucher_type,
          n.read_at::text,
          n.created_at::text
        from app_notifications n
        join dunnes_vouchers v on v.id = n.voucher_id
        where n.profile_id = ${profile.id}::uuid
        order by n.created_at desc
        limit 30
      `,
      sql<{ count: number }[]>`
        select count(*)::int as count
        from app_notifications
        where profile_id = ${profile.id}::uuid
          and read_at is null
      `,
    ]);
    return Response.json(
      { notifications, unreadCount: Number(unreadRows[0]?.count ?? 0) },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    console.error("Notification list failed", error);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const profile = await authenticatedRequestProfile(request);
  if (!profile) return Response.json({ error: "auth_required" }, { status: 401 });
  if (profile.isBlocked) return Response.json({ error: "unavailable" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const sql = getSqlClient();
  if (body.action === "mark_all_read") {
    await sql`
      update app_notifications
      set read_at = coalesce(read_at, now())
      where profile_id = ${profile.id}::uuid
        and read_at is null
    `;
    return Response.json({ ok: true }, { headers: { "cache-control": "private, no-store" } });
  }

  if (body.action === "mark_read" && typeof body.notificationId === "string" && uuidPattern.test(body.notificationId)) {
    await sql`
      update app_notifications
      set read_at = coalesce(read_at, now())
      where id = ${body.notificationId}::uuid
        and profile_id = ${profile.id}::uuid
    `;
    return Response.json({ ok: true }, { headers: { "cache-control": "private, no-store" } });
  }

  return Response.json({ error: "invalid_request" }, { status: 400 });
}

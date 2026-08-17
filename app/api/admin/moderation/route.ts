import { getSqlClient } from "@/db";
import { ADMIN_COOKIE_NAME, readCookie, requestHasSameOrigin, verifyAdminToken } from "@/app/admin/session";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const password = process.env.ADMIN_PASSWORD ?? "";
  const token = readCookie(request.headers.get("cookie"), ADMIN_COOKIE_NAME);
  if (!await verifyAdminToken(token, password)) return new Response("Admin login required", { status: 401 });

  const form = await request.formData();
  const action = String(form.get("action") ?? "");
  const targetId = String(form.get("targetId") ?? "");
  if (!uuidPattern.test(targetId)) return new Response("Invalid target", { status: 400 });

  const sql = getSqlClient();
  if (action === "approve_card") {
    await sql`
      update lidl_cards
      set is_shared = true, review_status = 'approved', review_note = null, updated_at = now()
      where id = ${targetId}::uuid
    `;
  } else if (action === "resolve_lidl_reports") {
    await sql.begin(async (tx) => {
      await tx`
        update lidl_card_reports
        set status = 'resolved', resolved_at = now()
        where card_id = ${targetId}::uuid and status = 'open'
      `;
      await tx`
        update lidl_cards
        set is_shared = true, review_status = 'approved', review_note = null, updated_at = now()
        where id = ${targetId}::uuid
      `;
    });
  } else if (action === "reject_card") {
    await sql.begin(async (tx) => {
      const [card] = await tx<{ owner_id: string }[]>`
        select owner_id::text
        from lidl_cards
        where id = ${targetId}::uuid
        for update
      `;
      if (!card) return;

      await tx`delete from coupons where owner_id = ${card.owner_id}::uuid`;
      await tx`delete from lidl_cards where id = ${targetId}::uuid`;
    });
  } else if (action === "approve_dunnes") {
    await sql`
      update dunnes_vouchers
      set review_status = 'approved', updated_at = now()
      where id = ${targetId}::uuid
    `;
  } else if (action === "reject_dunnes") {
    await sql`
      delete from dunnes_vouchers
      where id = ${targetId}::uuid
    `;
  } else if (action === "resolve_dunnes_reports") {
    await sql`
      update dunnes_voucher_reports
      set status = 'resolved', resolved_at = now()
      where voucher_id = ${targetId}::uuid and status = 'open'
    `;
  } else if (action === "reset_dunnes_reservations") {
    await sql`
      delete from dunnes_daily_reservations
      where profile_id = ${targetId}::uuid
        and usage_date = (now() at time zone 'Europe/Dublin')::date
    `;
  } else if (action === "reset_dunnes_upload_limit") {
    await sql`
      delete from api_rate_limits
      where profile_id = ${targetId}::uuid
        and action = 'dunnes:upload'
        and window_start = to_timestamp(floor(extract(epoch from now()) / 86400) * 86400)
    `;
  } else if (action === "resolve_error_report") {
    await sql`
      update user_error_reports
      set status = 'resolved', resolved_at = now()
      where id = ${targetId}::uuid and status = 'open'
    `;
  } else if (action === "delete_error_report") {
    await sql`delete from user_error_reports where id = ${targetId}::uuid`;
  } else if (action === "block_user" || action === "unblock_user") {
    const isBlocking = action === "block_user";
    await sql.begin(async (tx) => {
      await tx`
        update profiles
        set is_blocked = ${isBlocking}, updated_at = now()
        where id = ${targetId}::uuid
      `;
      if (isBlocking) {
        await tx`
          update lidl_cards
          set
            is_shared = false,
            qr_object_path = null,
            qr_fingerprint = null,
            qr_image_hash = null,
            review_note = 'Blocked by admin',
            updated_at = now()
          where owner_id = ${targetId}::uuid
        `;
      }
    });
  } else {
    return new Response("Invalid action", { status: 400 });
  }

  const redirectPath = action.startsWith("reset_dunnes_") ? "/admin#user-controls" : "/admin";
  return Response.redirect(new URL(redirectPath, request.url), 303);
}

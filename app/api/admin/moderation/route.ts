import { getSqlClient } from "@/db";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });

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

  return Response.redirect(new URL("/admin", request.url), 303);
}

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
  if (action === "approve_card" || action === "reject_card") {
    const reviewStatus = action === "approve_card" ? "approved" : "rejected";
    await sql`
      update lidl_cards
      set review_status = ${reviewStatus}, updated_at = now()
      where id = ${targetId}::uuid
    `;
  } else if (action === "block_user" || action === "unblock_user") {
    await sql`
      update profiles
      set is_blocked = ${action === "block_user"}, updated_at = now()
      where id = ${targetId}::uuid
    `;
  } else {
    return new Response("Invalid action", { status: 400 });
  }

  return Response.redirect(new URL("/admin", request.url), 303);
}

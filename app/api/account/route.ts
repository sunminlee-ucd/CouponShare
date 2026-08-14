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

export async function GET(request: Request) {
  const deviceKey = new URL(request.url).searchParams.get("deviceKey");
  if (!deviceKey || !uuidPattern.test(deviceKey)) return Response.json({ error: "invalid_device" }, { status: 400 });
  const sql = getSqlClient();
  const [profile] = await sql<{ id: string; created_at: string; updated_at: string }[]>`
    select id::text, created_at::text, updated_at::text from profiles where device_key = ${deviceKey}::uuid limit 1
  `;
  if (!profile) return Response.json({ profile: null, coupons: [], dunnesVouchers: [] });
  const [coupons, vouchers] = await Promise.all([
    sql`select product_name, label, expires_text, max_units, is_active, used_at::text from coupons where owner_id = ${profile.id}::uuid order by created_at`,
    sql`select voucher_type, right(barcode, 4) as barcode_last_four, membership_required, expires_on::text, status, created_at::text from dunnes_vouchers where owner_id = ${profile.id}::uuid order by created_at`,
  ]);
  return Response.json({ exportedAt: new Date().toISOString(), profile, coupons, dunnesVouchers: vouchers }, { headers: { "cache-control": "private, no-store" } });
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  let body: { deviceKey?: string; confirmation?: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  if (!body.deviceKey || !uuidPattern.test(body.deviceKey) || body.confirmation !== "DELETE") {
    return Response.json({ error: "confirmation_required" }, { status: 400 });
  }
  const sql = getSqlClient();
  const deleted = await sql`delete from profiles where device_key = ${body.deviceKey}::uuid returning id`;
  return Response.json({ deleted: deleted.length > 0 }, { headers: { "cache-control": "no-store" } });
}

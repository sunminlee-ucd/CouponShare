import { getSqlClient } from "@/db";
import { ADMIN_COOKIE_NAME, readCookie, requestHasSameOrigin, verifyAdminToken } from "@/app/admin/session";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type VoucherRow = {
  voucher_id: string;
  voucher_label: string;
  barcode: string;
  status: "available" | "reserved" | "used" | "expired" | "rejected";
  review_status: "pending" | "approved" | "rejected";
  expires_on: string;
};

async function requireAdmin(request: Request) {
  const password = process.env.ADMIN_PASSWORD ?? "";
  const token = readCookie(request.headers.get("cookie"), ADMIN_COOKIE_NAME);
  return verifyAdminToken(token, password);
}

export async function GET(request: Request) {
  if (!await requireAdmin(request)) return Response.json({ error: "admin_login_required" }, { status: 401 });
  const profileId = new URL(request.url).searchParams.get("profileId") ?? "";
  if (!uuidPattern.test(profileId)) return Response.json({ error: "invalid_profile" }, { status: 400 });

  const sql = getSqlClient();
  const vouchers = await sql<VoucherRow[]>`
    select
      id::text as voucher_id,
      case voucher_type
        when '5off25' then '€5 OFF €25'
        when '10off40' then '€10 OFF €40'
        when '10off50' then '€10 OFF €50'
        else voucher_type
      end as voucher_label,
      barcode,
      status,
      review_status,
      expires_on::text
    from dunnes_vouchers
    where owner_id = ${profileId}::uuid
    order by created_at desc
    limit 100
  `;

  return Response.json({ vouchers }, { headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!await requireAdmin(request)) return Response.json({ error: "admin_login_required" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const voucherId = typeof body.voucherId === "string" ? body.voucherId : "";
  if (body.action !== "reset_voucher" || !uuidPattern.test(voucherId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const sql = getSqlClient();
  const [deleted] = await sql<{ id: string }[]>`
    delete from dunnes_vouchers
    where id = ${voucherId}::uuid
      and status <> 'reserved'
    returning id::text
  `;

  if (!deleted) {
    const [existing] = await sql<{ status: string }[]>`
      select status from dunnes_vouchers where id = ${voucherId}::uuid limit 1
    `;
    if (existing?.status === "reserved") return Response.json({ error: "voucher_reserved" }, { status: 409 });
    return Response.json({ error: "voucher_not_found" }, { status: 404 });
  }

  return Response.json({ ok: true }, { headers: { "cache-control": "private, no-store" } });
}

import { getSqlClient } from "@/db";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const imagePattern = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMAGE_LENGTH = 900_000;

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
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const deviceKey = typeof body.deviceKey === "string" ? body.deviceKey : "";
  const imageData = typeof body.imageData === "string" ? body.imageData : "";
  if (!uuidPattern.test(deviceKey) || !imagePattern.test(imageData) || imageData.length > MAX_IMAGE_LENGTH) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const sql = getSqlClient();
  const [profile] = await sql<{ id: string; is_blocked: boolean }[]>`
    select id::text, is_blocked
    from profiles
    where device_key = ${deviceKey}::uuid
    limit 1
  `;
  if (!profile || profile.is_blocked) return Response.json({ error: "unavailable" }, { status: 404 });

  const [voucher] = await sql<{ barcode: string }[]>`
    select barcode
    from dunnes_vouchers
    where image_data = ${imageData}
      and (
        owner_id = ${profile.id}::uuid
        or (reserved_by = ${profile.id}::uuid and status = 'reserved')
      )
    limit 1
  `;
  if (!voucher) return Response.json({ error: "unavailable" }, { status: 404 });

  return Response.json({ barcode: voucher.barcode }, { headers: { "cache-control": "private, no-store" } });
}

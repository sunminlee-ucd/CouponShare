import { authenticatedRequestProfile } from "@/app/auth/request-profile";
import { requestHasSameOrigin } from "@/app/auth/session";
import { getSqlClient } from "@/db";

export const runtime = "nodejs";

const imagePattern = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMAGE_LENGTH = 900_000;

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

  const imageData = typeof body.imageData === "string" ? body.imageData : "";
  if (!imagePattern.test(imageData) || imageData.length > MAX_IMAGE_LENGTH) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const sql = getSqlClient();
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

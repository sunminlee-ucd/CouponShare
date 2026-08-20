import { getSqlClient } from "@/db";
import { ADMIN_COOKIE_NAME, readCookie, verifyAdminToken } from "@/app/admin/session";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const imageDataPattern = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;

function imageResponse(imageData: string | null) {
  if (!imageData) return new Response("Image not found", { status: 404 });
  const match = imageData.match(imageDataPattern);
  if (!match) return new Response("Invalid stored image", { status: 422 });

  return new Response(Buffer.from(match[2], "base64"), {
    status: 200,
    headers: {
      "content-type": match[1],
      "cache-control": "private, no-store, max-age=0",
      "content-disposition": "inline",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function GET(request: Request) {
  const password = process.env.ADMIN_PASSWORD ?? "";
  const token = readCookie(request.headers.get("cookie"), ADMIN_COOKIE_NAME);
  if (!await verifyAdminToken(token, password)) return new Response("Admin login required", { status: 401 });

  const url = new URL(request.url);
  const voucherId = url.searchParams.get("voucherId") ?? "";
  const kind = url.searchParams.get("kind") ?? "voucher";
  if (!uuidPattern.test(voucherId) || (kind !== "voucher" && kind !== "membership")) {
    return new Response("Invalid request", { status: 400 });
  }

  const sql = getSqlClient();
  if (kind === "membership") {
    const [voucher] = await sql<{ image_data: string | null }[]>`
      select membership_image_data as image_data
      from dunnes_vouchers
      where id = ${voucherId}::uuid
      limit 1
    `;
    return imageResponse(voucher?.image_data ?? null);
  }

  const [voucher] = await sql<{ image_data: string | null }[]>`
    select image_data
    from dunnes_vouchers
    where id = ${voucherId}::uuid
    limit 1
  `;
  return imageResponse(voucher?.image_data ?? null);
}

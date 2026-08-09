import { getSqlClient } from "@/db";

export const runtime = "nodejs";

const ALPHA_GROUP_CODE = "couponshare-alpha-v1";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const qrDataPattern = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;

export async function POST(request: Request) {
  let body: { deviceKey?: string; ownerId?: string };
  try {
    body = await request.json() as { deviceKey?: string; ownerId?: string };
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const deviceKey = body.deviceKey ?? null;
  const ownerId = body.ownerId ?? null;
  if (!deviceKey || !ownerId || !uuidPattern.test(deviceKey) || !uuidPattern.test(ownerId)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const sql = getSqlClient();
    const [card] = await sql<{ qr_data: string }[]>`
      select card.qr_object_path as qr_data
      from profiles requester
      join group_members requester_membership on requester_membership.profile_id = requester.id
      join groups g on g.id = requester_membership.group_id and g.invite_code = ${ALPHA_GROUP_CODE}
      join group_members owner_membership on owner_membership.group_id = g.id
      join lidl_cards card on card.owner_id = owner_membership.profile_id and card.is_shared = true
      where requester.device_key = ${deviceKey}::uuid
        and owner_membership.profile_id = ${ownerId}::uuid
      limit 1
    `;
    const match = card?.qr_data?.match(qrDataPattern);
    if (!match) return new Response("Not found", { status: 404 });
    return new Response(Buffer.from(match[2], "base64"), {
      headers: {
        "content-type": match[1],
        "cache-control": "private, no-store, max-age=0",
        "content-security-policy": "default-src 'none'",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Shared QR read failed", error);
    return new Response("Unavailable", { status: 503 });
  }
}

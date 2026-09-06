import { getSqlClient } from "@/db";
import { authenticatedRequestProfile } from "@/app/auth/request-profile";
import { requestHasSameOrigin } from "@/app/auth/session";

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

  try {
    const sql = getSqlClient();
    const [used] = await sql`
      update dunnes_vouchers
      set status = 'used', used_at = now(), updated_at = now()
      where status = 'reserved'
        and reserved_by = ${profile.id}::uuid
        and reserved_at is not null
        and reserved_at >= now() - interval '30 minutes'
        and md5(image_data) = md5(${imageData})
      returning id
    `;

    if (!used) return Response.json({ error: "completion_unavailable" }, { status: 409 });

    return Response.json(
      { ok: true, status: "used" },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    console.error("Dunnes completion failed", error);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}

import { authenticatedRequestProfile } from "@/app/auth/request-profile";
import { requestHasSameOrigin } from "@/app/auth/session";
import { requestUnusedReviewByImage, requestUnusedReviewByVoucherId } from "@/app/dunnes/unused-review";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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

  let result = null;
  if (typeof body.imageData === "string") {
    if (body.imageData.length > MAX_IMAGE_LENGTH || !imagePattern.test(body.imageData)) {
      return Response.json({ error: "invalid_request" }, { status: 400 });
    }
    result = await requestUnusedReviewByImage(profile.id, body.imageData);
  } else if (typeof body.voucherId === "string" && uuidPattern.test(body.voucherId)) {
    result = await requestUnusedReviewByVoucherId(profile.id, body.voucherId);
  } else {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!result) return Response.json({ error: "review_unavailable" }, { status: 409 });
  return Response.json({ ok: true, status: "owner_confirmation" }, { headers: { "cache-control": "private, no-store" } });
}

import { authenticatedRequestProfile } from "@/app/auth/request-profile";
import { requestHasSameOrigin } from "@/app/auth/session";
import { requestUnusedReviewByImage } from "@/app/dunnes/unused-review";

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

  const review = await requestUnusedReviewByImage(profile.id, imageData);
  if (!review) return Response.json({ error: "review_unavailable" }, { status: 409 });

  return Response.json(
    { ok: true, status: "owner_confirmation" },
    { headers: { "cache-control": "private, no-store" } },
  );
}

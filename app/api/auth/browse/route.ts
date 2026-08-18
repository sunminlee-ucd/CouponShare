import {
  authConfiguration,
  browseAccessCookie,
  createBrowseAccessToken,
} from "@/app/auth/session";

export const runtime = "nodejs";

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
  const configuration = await authConfiguration();
  if (!configuration.configured) return Response.json({ error: "auth_not_configured" }, { status: 503 });

  const token = await createBrowseAccessToken();
  return Response.json({ ok: true }, {
    headers: {
      "cache-control": "no-store",
      "set-cookie": browseAccessCookie(token),
    },
  });
}

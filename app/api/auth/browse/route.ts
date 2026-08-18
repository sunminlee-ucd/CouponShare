import {
  authConfiguration,
  browseAccessCookie,
  createBrowseAccessToken,
  requestHasSameOrigin,
} from "@/app/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
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

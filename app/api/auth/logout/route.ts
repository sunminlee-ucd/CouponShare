import {
  clearBrowseAccessCookie,
  clearUserAuthCookie,
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
  const headers = new Headers({ "cache-control": "no-store" });
  headers.append("set-cookie", clearUserAuthCookie());
  headers.append("set-cookie", clearBrowseAccessCookie());
  return Response.json({ ok: true }, { headers });
}

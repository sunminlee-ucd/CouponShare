import {
  clearBrowseAccessCookie,
  clearUserAuthCookie,
} from "@/app/auth/session";

export const runtime = "nodejs";

function trustedSameSiteRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === new URL(request.url).host;
    } catch {
      return false;
    }
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  return fetchSite === "same-origin" || fetchSite === "none";
}

export async function POST(request: Request) {
  if (!trustedSameSiteRequest(request)) return Response.json({ error: "forbidden" }, { status: 403 });

  const headers = new Headers({
    "cache-control": "no-store",
    location: "/login",
  });
  headers.append("set-cookie", clearUserAuthCookie());
  headers.append("set-cookie", clearBrowseAccessCookie());

  return new Response(null, { status: 303, headers });
}

import { ADMIN_COOKIE_NAME, ADMIN_SESSION_MAX_AGE, createAdminToken } from "@/app/admin/session";
import { secureTextEqual } from "@/app/access/session";

export const runtime = "nodejs";

const failedAttempts = new Map<string, { count: number; resetAt: number }>();

function sameOrigin(request: Request) {
  try {
    const requestHost = new URL(request.url).host;
    const origin = request.headers.get("origin");
    if (origin) return new URL(origin).host === requestHost;
    const referer = request.headers.get("referer");
    if (referer) return new URL(referer).host === requestHost;
    return request.headers.get("sec-fetch-site") === "same-origin";
  } catch {
    return false;
  }
}

function requestAddress(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (password.length < 16) return Response.json({ error: "not_configured" }, { status: 503 });

  const address = requestAddress(request);
  const now = Date.now();
  const previous = failedAttempts.get(address);
  if (previous && previous.resetAt > now && previous.count >= 5) {
    return Response.json({ error: "too_many_attempts" }, { status: 429 });
  }

  let suppliedPassword = "";
  let formSubmission = false;
  try {
    formSubmission = request.headers.get("content-type")?.includes("application/x-www-form-urlencoded") === true
      || request.headers.get("content-type")?.includes("multipart/form-data") === true;
    if (formSubmission) {
      const form = await request.formData();
      suppliedPassword = String(form.get("password") ?? "");
    } else {
      const body = await request.json() as { password?: string };
      suppliedPassword = body.password ?? "";
    }
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!await secureTextEqual(suppliedPassword, password)) {
    const current = previous && previous.resetAt > now ? previous : { count: 0, resetAt: now + 15 * 60 * 1000 };
    failedAttempts.set(address, { ...current, count: current.count + 1 });
    if (formSubmission) return Response.redirect(new URL("/admin/login?error=invalid_password", request.url), 303);
    return Response.json({ error: "invalid_password" }, { status: 401 });
  }

  failedAttempts.delete(address);
  const token = await createAdminToken(password);
  const headers = {
    "cache-control": "no-store",
    "set-cookie": `${ADMIN_COOKIE_NAME}=${token}; Path=/; Max-Age=${ADMIN_SESSION_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
  };
  if (formSubmission) {
    return new Response(null, { status: 303, headers: { ...headers, location: new URL("/admin", request.url).toString() } });
  }
  return Response.json({ ok: true }, {
    headers: {
      ...headers,
    },
  });
}

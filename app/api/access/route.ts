import { ACCESS_COOKIE_NAME, accessConfiguration, createAccessToken, secureTextEqual } from "@/app/access/session";

export const runtime = "nodejs";

const failedAttempts = new Map<string, { count: number; resetAt: number }>();

function requestAddress(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

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
  const address = requestAddress(request);
  const now = Date.now();
  const previous = failedAttempts.get(address);
  if (previous && previous.resetAt > now && previous.count >= 5) {
    return Response.json({ error: "too_many_attempts" }, {
      status: 429,
      headers: { "retry-after": String(Math.ceil((previous.resetAt - now) / 1000)) },
    });
  }
  const configuration = await accessConfiguration();
  if (!configuration.configured) return Response.json({ error: "access_not_configured" }, { status: 503 });

  let body: { accessCode?: string; acceptedPrivacy?: boolean; acceptedTerms?: boolean };
  try {
    body = await request.json() as typeof body;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  if (!body.acceptedPrivacy || !body.acceptedTerms) {
    return Response.json({ error: "consent_required" }, { status: 400 });
  }
  if (!await secureTextEqual(body.accessCode?.trim() ?? "", configuration.accessCode)) {
    const current = previous && previous.resetAt > now ? previous : { count: 0, resetAt: now + 15 * 60 * 1000 };
    failedAttempts.set(address, { ...current, count: current.count + 1 });
    return Response.json({ error: "invalid_access_code" }, { status: 401 });
  }

  failedAttempts.delete(address);
  const token = await createAccessToken(configuration.sessionSecret);
  return Response.json({ ok: true }, {
    headers: {
      "cache-control": "no-store",
      "set-cookie": `${ACCESS_COOKIE_NAME}=${token}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}

export async function DELETE() {
  return Response.json({ ok: true }, {
    headers: {
      "cache-control": "no-store",
      "set-cookie": `${ACCESS_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}

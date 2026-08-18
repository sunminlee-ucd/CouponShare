import { createHash, randomBytes } from "node:crypto";
import { authConfiguration, oauthPkceCookie } from "@/app/auth/session";
import { publicRequestUrl } from "@/app/auth/public-url";

export const runtime = "nodejs";

function loginErrorRedirect(request: Request, code: string) {
  const target = publicRequestUrl(request, "/login");
  target.searchParams.set("oauthError", code);
  return Response.redirect(target, 302);
}

export async function GET(request: Request) {
  const configuration = await authConfiguration();
  if (!configuration.configured) return loginErrorRedirect(request, "auth_not_configured");

  const url = new URL(request.url);
  const provider = url.searchParams.get("provider");
  if (provider !== "google") return loginErrorRedirect(request, "unsupported_provider");

  // Build redirects from the public proxy-aware origin so Supabase allow-list matching remains reliable behind Cloud Run.
  const callback = publicRequestUrl(request, "/auth/callback");
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");

  const authorize = new URL(`${configuration.url}/auth/v1/authorize`);
  authorize.searchParams.set("provider", "google");
  authorize.searchParams.set("redirect_to", callback.toString());
  authorize.searchParams.set("scopes", "email profile");
  authorize.searchParams.set("code_challenge", codeChallenge);
  authorize.searchParams.set("code_challenge_method", "s256");
  authorize.searchParams.set("prompt", "select_account");

  console.info("Starting Google OAuth", {
    callbackOrigin: callback.origin,
    callbackPath: callback.pathname,
  });

  const headers = new Headers({
    location: authorize.toString(),
    "cache-control": "no-store",
  });
  headers.append("set-cookie", oauthPkceCookie(codeVerifier));
  return new Response(null, { status: 302, headers });
}

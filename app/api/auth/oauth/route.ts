import { createHash, randomBytes } from "node:crypto";
import { authConfiguration, oauthPkceCookie } from "@/app/auth/session";

export const runtime = "nodejs";

function loginErrorRedirect(request: Request, code: string) {
  const target = new URL("/login", request.url);
  target.searchParams.set("oauthError", code);
  return Response.redirect(target, 302);
}

export async function GET(request: Request) {
  const configuration = await authConfiguration();
  if (!configuration.configured) return loginErrorRedirect(request, "auth_not_configured");

  const url = new URL(request.url);
  const provider = url.searchParams.get("provider");
  if (provider !== "google") return loginErrorRedirect(request, "unsupported_provider");

  // Supabase's PKCE OAuth flow returns an auth code to this exact callback URL.
  // Keep the callback exact so it matches the Supabase redirect allow-list entry.
  const callback = new URL("/auth/callback", request.url);
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");

  const authorize = new URL(`${configuration.url}/auth/v1/authorize`);
  authorize.searchParams.set("provider", "google");
  authorize.searchParams.set("redirect_to", callback.toString());
  authorize.searchParams.set("scopes", "email profile");
  authorize.searchParams.set("flow_type", "pkce");
  authorize.searchParams.set("code_challenge", codeChallenge);
  authorize.searchParams.set("code_challenge_method", "s256");
  // Always show Google's account chooser so the user knows which account is being used.
  authorize.searchParams.set("prompt", "select_account");

  const headers = new Headers({
    location: authorize.toString(),
    "cache-control": "no-store",
  });
  headers.append("set-cookie", oauthPkceCookie(codeVerifier));
  return new Response(null, { status: 302, headers });
}

import { authConfiguration } from "@/app/auth/session";

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

  // Keep this URL exact so it matches the Supabase redirect allow-list entry.
  const callback = new URL("/auth/callback", request.url);
  const authorize = new URL(`${configuration.url}/auth/v1/authorize`);
  authorize.searchParams.set("provider", "google");
  authorize.searchParams.set("redirect_to", callback.toString());
  authorize.searchParams.set("scopes", "email profile");
  // Provider-specific OAuth parameters are forwarded by Supabase Auth.
  // Force Google to show the chooser instead of silently reusing an existing Google session.
  authorize.searchParams.set("prompt", "select_account");

  return Response.redirect(authorize, 302);
}

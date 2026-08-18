import { authConfiguration } from "@/app/auth/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const configuration = await authConfiguration();
  if (!configuration.configured) return Response.json({ error: "auth_not_configured" }, { status: 503 });

  const url = new URL(request.url);
  const provider = url.searchParams.get("provider");
  if (provider !== "google") {
    return Response.json({ error: "unsupported_provider" }, { status: 400 });
  }

  // Keep this URL exact. Supabase redirect allow-list matching can include the full URL,
  // so app state is stored in sessionStorage by the login page instead of query parameters.
  const callback = new URL("/auth/callback", request.url);
  const authorize = new URL(`${configuration.url}/auth/v1/authorize`);
  authorize.searchParams.set("provider", "google");
  authorize.searchParams.set("redirect_to", callback.toString());
  authorize.searchParams.set("scopes", "email profile");

  return Response.redirect(authorize, 302);
}

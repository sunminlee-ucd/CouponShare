import { authConfiguration } from "@/app/auth/session";

export const runtime = "nodejs";

function safeReturnTo(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function GET(request: Request) {
  const configuration = await authConfiguration();
  if (!configuration.configured) return Response.json({ error: "auth_not_configured" }, { status: 503 });

  const url = new URL(request.url);
  const provider = url.searchParams.get("provider");
  if (provider !== "google") {
    return Response.json({ error: "unsupported_provider" }, { status: 400 });
  }

  const callback = new URL("/auth/callback", request.url);
  callback.searchParams.set("returnTo", safeReturnTo(url.searchParams.get("returnTo")));
  const authorize = new URL(`${configuration.url}/auth/v1/authorize`);
  authorize.searchParams.set("provider", "google");
  authorize.searchParams.set("redirect_to", callback.toString());

  return Response.redirect(authorize, 302);
}

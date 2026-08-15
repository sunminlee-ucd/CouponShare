import { ADMIN_COOKIE_NAME } from "@/app/admin/session";

export async function POST(request: Request) {
  return new Response(null, {
    status: 303,
    headers: {
      location: new URL("/admin/login", request.url).toString(),
      "set-cookie": `${ADMIN_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}

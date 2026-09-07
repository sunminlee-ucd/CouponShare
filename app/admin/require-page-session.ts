import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/app/admin/session";

export async function requireAdminPage(returnTo: string) {
  const password = process.env.ADMIN_PASSWORD ?? "";
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!await verifyAdminToken(token, password)) {
    redirect(`/admin/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
}

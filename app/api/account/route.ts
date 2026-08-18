import { authenticatedRequestProfile } from "@/app/auth/request-profile";
import {
  autoLoginPreferenceCookie,
  clearBrowseAccessCookie,
  clearOAuthPkceCookie,
  clearUserAuthCookie,
  requestHasSameOrigin,
} from "@/app/auth/session";
import { getSqlClient } from "@/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const profile = await authenticatedRequestProfile(request);
  if (!profile) return Response.json({ error: "auth_required" }, { status: 401 });
  if (profile.isBlocked) return Response.json({ error: "blocked" }, { status: 403 });

  try {
    const sql = getSqlClient();
    const [account, profileRecord, coupons, vouchers, reservationHistory, reports] = await Promise.all([
      sql<{ email: string | null; provider: string }[]>`
        select email, coalesce(raw_app_meta_data ->> 'provider', 'email') as provider
        from auth.users
        where id = ${profile.authUserId}::uuid
        limit 1
      `,
      sql<{ id: string; created_at: string; updated_at: string }[]>`
        select id::text, created_at::text, updated_at::text
        from profiles
        where id = ${profile.id}::uuid
        limit 1
      `,
      sql`
        select product_name, label, expires_text, max_units, is_active, used_at::text
        from coupons
        where owner_id = ${profile.id}::uuid
        order by created_at
      `,
      sql`
        select voucher_type, right(barcode, 4) as barcode_last_four, membership_required,
          expires_on::text, status, review_status, created_at::text, used_at::text
        from dunnes_vouchers
        where owner_id = ${profile.id}::uuid
        order by created_at
      `,
      sql`
        select usage_date::text, reservation_count, updated_at::text
        from dunnes_daily_reservations
        where profile_id = ${profile.id}::uuid
        order by usage_date
      `,
      sql`
        select category, message, page_path, status, created_at::text, resolved_at::text
        from user_error_reports
        where reporter_id = ${profile.id}::uuid
        order by created_at
      `,
    ]);

    return Response.json({
      exportedAt: new Date().toISOString(),
      account: account[0] ?? null,
      profile: profileRecord[0] ?? null,
      coupons,
      dunnesVouchers: vouchers,
      dunnesReservationHistory: reservationHistory,
      errorReports: reports,
    }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    console.error("Account export failed", error);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });

  const profile = await authenticatedRequestProfile(request);
  if (!profile) return Response.json({ error: "auth_required" }, { status: 401 });

  let body: { confirmation?: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  if (body.confirmation !== "DELETE") {
    return Response.json({ error: "confirmation_required" }, { status: 400 });
  }

  try {
    const sql = getSqlClient();
    await sql.begin(async (tx) => {
      const deletedProfiles = await tx`
        delete from profiles
        where id = ${profile.id}::uuid
          and auth_user_id = ${profile.authUserId}::uuid
        returning id
      `;
      if (!deletedProfiles.length) throw new Error("profile_not_found");

      const deletedUsers = await tx`
        delete from auth.users
        where id = ${profile.authUserId}::uuid
        returning id
      `;
      if (!deletedUsers.length) throw new Error("auth_user_not_found");
    });

    const headers = new Headers({ "cache-control": "no-store" });
    headers.append("set-cookie", clearUserAuthCookie());
    headers.append("set-cookie", clearBrowseAccessCookie());
    headers.append("set-cookie", clearOAuthPkceCookie());
    headers.append("set-cookie", autoLoginPreferenceCookie(false));
    return Response.json({ deleted: true }, { headers });
  } catch (error) {
    console.error("Account deletion failed", error);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}

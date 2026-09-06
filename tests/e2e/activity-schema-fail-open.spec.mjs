import crypto from "node:crypto";
import postgres from "postgres";
import { test, expect } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const SESSION_SECRET = process.env.CI_AUTH_SESSION_SECRET ?? "";
const ADMIN_PASSWORD = process.env.CI_ADMIN_PASSWORD ?? "";
const DATABASE_URL = process.env.DATABASE_URL ?? "";

const USER = {
  profileId: "51515151-5151-4151-8151-515151515151",
  deviceKey: "52525252-5252-4252-8252-525252525252",
  authUserId: "53535353-5353-4353-8353-535353535353",
};
const SESSION_ID = "54545454-5454-4454-8454-545454545454";
const EXISTING_VOUCHER_ID = "11111111-1111-4111-8111-111111111111";

function userToken(secret) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 30 * 24 * 60 * 60 * 1000;
  const payload = `${USER.authUserId}.${USER.profileId}.${issuedAt}.${expiresAt}`;
  const signature = crypto.createHmac("sha256", `couponshare-auth-session-v1:${secret}`).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function adminToken(password) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 30 * 24 * 60 * 60 * 1000;
  const payload = `${issuedAt}.${expiresAt}`;
  const signature = crypto.createHmac("sha256", password).update(`couponshare-admin-session-v1.${payload}`).digest("base64url");
  return `${payload}.${signature}`;
}

test("missing activity schema never changes existing CouponShare data or blocks Dunnes APIs", async ({ browser }) => {
  test.setTimeout(60000);
  expect(SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
  expect(ADMIN_PASSWORD.length).toBeGreaterThanOrEqual(16);
  expect(DATABASE_URL.length).toBeGreaterThan(0);

  const sql = postgres(DATABASE_URL, { max: 1 });
  let beforeVoucher;
  let beforeProfileCount;
  try {
    await sql`delete from profiles where id = ${USER.profileId}::uuid`;
    await sql`
      insert into profiles (id, device_key, auth_user_id, is_blocked, created_at, updated_at)
      values (${USER.profileId}::uuid, ${USER.deviceKey}::uuid, ${USER.authUserId}::uuid, false, now(), '2026-03-03T12:34:56Z'::timestamptz)
    `;
    [beforeVoucher] = await sql`
      select id::text as id, barcode, status, review_status, owner_id::text as owner_id, updated_at::text as updated_at
      from dunnes_vouchers where id = ${EXISTING_VOUCHER_ID}::uuid
    `;
    [beforeProfileCount] = await sql`select count(*)::int as count from profiles`;
    await sql`drop table if exists app_user_sessions`;
  } finally {
    await sql.end();
  }

  expect(beforeVoucher?.id).toBe(EXISTING_VOUCHER_ID);

  const user = await browser.newContext();
  const admin = await browser.newContext();
  await user.addCookies([{ name: "couponshare_user_v1", value: userToken(SESSION_SECRET), url: BASE_URL, httpOnly: true, secure: false, sameSite: "Lax" }]);
  await admin.addCookies([{ name: "couponshare_admin_v1", value: adminToken(ADMIN_PASSWORD), url: BASE_URL, httpOnly: true, secure: false, sameSite: "Lax" }]);

  try {
    const activityResponse = await user.request.post(`${BASE_URL}/api/activity-session`, {
      headers: { origin: BASE_URL, "content-type": "application/json" },
      data: { action: "start", sessionId: SESSION_ID, path: "/dunnes" },
    });
    expect(activityResponse.status()).toBe(200);
    expect(await activityResponse.json()).toMatchObject({ ok: true, tracked: false, reason: "activity_schema_pending" });

    const adminActivityResponse = await admin.request.get(`${BASE_URL}/api/admin/user-activity`);
    expect(adminActivityResponse.status()).toBe(200);
    expect(await adminActivityResponse.json()).toMatchObject({
      available: false,
      summary: { online_now: 0, sessions_today: 0, unique_users_today: 0, total_sessions: 0, tracked_users: 0, page_views_today: 0 },
      users: [],
      recent: [],
    });

    const voucherResponse = await user.request.get(`${BASE_URL}/api/dunnes-vouchers?deviceKey=${USER.deviceKey}`);
    expect(voucherResponse.status()).toBe(200);
    const voucherPayload = await voucherResponse.json();
    expect(voucherPayload.vouchers.some((voucher) => voucher.id === EXISTING_VOUCHER_ID && voucher.status === "available")).toBe(true);

    const verifySql = postgres(DATABASE_URL, { max: 1 });
    try {
      const [afterVoucher] = await verifySql`
        select id::text as id, barcode, status, review_status, owner_id::text as owner_id, updated_at::text as updated_at
        from dunnes_vouchers where id = ${EXISTING_VOUCHER_ID}::uuid
      `;
      const [afterProfileCount] = await verifySql`select count(*)::int as count from profiles`;
      const [testProfile] = await verifySql`
        select to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS') as updated_at
        from profiles where id = ${USER.profileId}::uuid
      `;

      expect(afterVoucher).toEqual(beforeVoucher);
      expect(afterProfileCount?.count).toBe(beforeProfileCount?.count);
      expect(testProfile?.updated_at).toBe("2026-03-03 12:34:56");
    } finally {
      await verifySql.end();
    }
  } finally {
    await user.close();
    await admin.close();
    const cleanupSql = postgres(DATABASE_URL, { max: 1 });
    try {
      await cleanupSql`delete from profiles where id = ${USER.profileId}::uuid`;
    } finally {
      await cleanupSql.end();
    }
  }
});

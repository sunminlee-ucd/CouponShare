import crypto from "node:crypto";
import postgres from "postgres";
import { test, expect } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const SESSION_SECRET = process.env.CI_AUTH_SESSION_SECRET ?? "";
const ADMIN_PASSWORD = process.env.CI_ADMIN_PASSWORD ?? "";
const DATABASE_URL = process.env.DATABASE_URL ?? "";

const OWNER = {
  profileId: "31313131-3131-4131-8131-313131313131",
  deviceKey: "32323232-3232-4232-8232-323232323232",
  authUserId: "33333333-3333-4333-8333-333333333333",
};
const RESERVER = {
  profileId: "34343434-3434-4434-8434-343434343434",
  deviceKey: "35353535-3535-4535-8535-353535353535",
  authUserId: "36363636-3636-4636-8636-363636363636",
};
const ACTIVITY_USER = {
  profileId: "41414141-4141-4141-8141-414141414141",
  deviceKey: "42424242-4242-4242-8242-424242424242",
  authUserId: "43434343-4343-4343-8343-434343434343",
};
const UNRELATED_USER = {
  profileId: "44444444-4444-4444-8444-444444444444",
  deviceKey: "45454545-4545-4545-8545-454545454545",
  authUserId: "46464646-4646-4646-8646-464646464646",
};
const VOUCHER_ID = "37373737-3737-4737-8737-373737373737";
const ACTIVITY_SESSION_ID = "47474747-4747-4747-8747-474747474747";
const IMAGE_DATA = `data:image/png;base64,${Buffer.from("direct-used-voucher").toString("base64")}`;

function userToken(secret, user) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 30 * 24 * 60 * 60 * 1000;
  const payload = `${user.authUserId}.${user.profileId}.${issuedAt}.${expiresAt}`;
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

async function signedInContext(browser, user) {
  const context = await browser.newContext();
  await context.addCookies([{ name: "couponshare_user_v1", value: userToken(SESSION_SECRET, user), url: BASE_URL, httpOnly: true, secure: false, sameSite: "Lax" }]);
  return context;
}

async function adminContext(browser) {
  const context = await browser.newContext();
  await context.addCookies([{ name: "couponshare_admin_v1", value: adminToken(ADMIN_PASSWORD), url: BASE_URL, httpOnly: true, secure: false, sameSite: "Lax" }]);
  return context;
}

async function ensureActivityTable(sql) {
  await sql`
    create table if not exists app_user_sessions (
      id uuid primary key,
      profile_id uuid not null references profiles(id) on delete cascade,
      started_at timestamptz not null default now(),
      last_seen_at timestamptz not null default now(),
      ended_at timestamptz,
      page_views integer not null default 1 check (page_views >= 1),
      last_path text not null default '/' check (char_length(last_path) between 1 and 240)
    )
  `;
}

test("user completion immediately marks a Dunnes voucher used and exposes today's safe activity", async ({ browser }) => {
  test.setTimeout(60000);
  expect(SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
  expect(ADMIN_PASSWORD.length).toBeGreaterThanOrEqual(16);
  expect(DATABASE_URL.length).toBeGreaterThan(0);

  const sql = postgres(DATABASE_URL, { max: 1 });
  try {
    await ensureActivityTable(sql);
    await sql`delete from dunnes_daily_reservations where profile_id in (${OWNER.profileId}::uuid, ${RESERVER.profileId}::uuid)`;
    await sql`delete from dunnes_vouchers where id = ${VOUCHER_ID}::uuid or owner_id in (${OWNER.profileId}::uuid, ${RESERVER.profileId}::uuid) or reserved_by in (${OWNER.profileId}::uuid, ${RESERVER.profileId}::uuid)`;
    await sql`delete from app_user_sessions where profile_id in (${OWNER.profileId}::uuid, ${RESERVER.profileId}::uuid)`;
    await sql`delete from profiles where id in (${OWNER.profileId}::uuid, ${RESERVER.profileId}::uuid)`;
    for (const user of [OWNER, RESERVER]) {
      await sql`insert into profiles (id, device_key, auth_user_id, updated_at) values (${user.profileId}::uuid, ${user.deviceKey}::uuid, ${user.authUserId}::uuid, now())`;
    }
    await sql`
      insert into dunnes_vouchers (
        id, owner_id, voucher_type, barcode, image_data, membership_required,
        expires_on, status, review_status, reserved_by, reserved_at, used_at
      ) values (
        ${VOUCHER_ID}::uuid, ${OWNER.profileId}::uuid, '10off40', '2708888888401', ${IMAGE_DATA}, false,
        '2099-09-06', 'reserved', 'approved', ${RESERVER.profileId}::uuid, now(), null
      )
    `;
  } finally {
    await sql.end();
  }

  const reserverContext = await signedInContext(browser, RESERVER);
  const ownerContext = await signedInContext(browser, OWNER);
  const admin = await adminContext(browser);

  try {
    const reserverPage = await reserverContext.newPage();
    await reserverPage.goto(`${BASE_URL}/dunnes`, { waitUntil: "domcontentloaded" });
    const completion = await reserverPage.evaluate(async (imageData) => {
      const response = await fetch("/api/dunnes-complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ imageData }),
      });
      return { status: response.status, body: await response.json() };
    }, IMAGE_DATA);
    expect(completion.status).toBe(200);
    expect(completion.body.status).toBe("used");

    const verifySql = postgres(DATABASE_URL, { max: 1 });
    try {
      const [used] = await verifySql`
        select status, reserved_by::text as reserved_by, reserved_at, used_at
        from dunnes_vouchers where id = ${VOUCHER_ID}::uuid
      `;
      expect(used?.status).toBe("used");
      expect(used?.reserved_by).toBe(RESERVER.profileId);
      expect(used?.reserved_at).not.toBeNull();
      expect(used?.used_at).not.toBeNull();
    } finally {
      await verifySql.end();
    }

    const publicActivityResponse = await ownerContext.request.get(`${BASE_URL}/api/dunnes-used-today`);
    expect(publicActivityResponse.status()).toBe(200);
    const publicActivity = await publicActivityResponse.json();
    expect(publicActivity.usedToday).toBeGreaterThanOrEqual(1);
    expect(publicActivity.vouchers.some((voucher) => voucher.voucher_id === VOUCHER_ID && voucher.voucher_type === "10off40")).toBe(true);

    const ownerStateResponse = await ownerContext.request.get(`${BASE_URL}/api/dunnes-vouchers?deviceKey=${OWNER.deviceKey}`);
    expect(ownerStateResponse.status()).toBe(200);
    const ownerState = await ownerStateResponse.json();
    const visibleUsed = ownerState.vouchers.find((voucher) => voucher.id === VOUCHER_ID);
    expect(visibleUsed?.status).toBe("used");
    expect(visibleUsed?.image_data).toBeNull();
    expect(visibleUsed?.reserved_by_me).toBe(false);

    const usageResponse = await admin.request.get(`${BASE_URL}/api/admin/dunnes-usage`);
    expect(usageResponse.status()).toBe(200);
    const usage = await usageResponse.json();
    expect(usage.summary.used_today).toBeGreaterThanOrEqual(1);
    expect(usage.summary.total_used).toBeGreaterThanOrEqual(1);
    expect(usage.recent.some((voucher) => voucher.voucher_id === VOUCHER_ID)).toBe(true);

    const queueResponse = await admin.request.get(`${BASE_URL}/api/admin/dunnes-review-queue`);
    expect(queueResponse.status()).toBe(200);
    const queue = await queueResponse.json();
    expect(queue.reviews.some((voucher) => voucher.voucher_id === VOUCHER_ID)).toBe(false);
  } finally {
    await reserverContext.close();
    await ownerContext.close();
    await admin.close();
    const cleanupSql = postgres(DATABASE_URL, { max: 1 });
    try {
      await cleanupSql`delete from dunnes_daily_reservations where profile_id in (${OWNER.profileId}::uuid, ${RESERVER.profileId}::uuid)`;
      await cleanupSql`delete from dunnes_vouchers where id = ${VOUCHER_ID}::uuid or owner_id in (${OWNER.profileId}::uuid, ${RESERVER.profileId}::uuid) or reserved_by in (${OWNER.profileId}::uuid, ${RESERVER.profileId}::uuid)`;
      await cleanupSql`delete from app_user_sessions where profile_id in (${OWNER.profileId}::uuid, ${RESERVER.profileId}::uuid)`;
      await cleanupSql`delete from profiles where id in (${OWNER.profileId}::uuid, ${RESERVER.profileId}::uuid)`;
    } finally {
      await cleanupSql.end();
    }
  }
});

test("activity analytics writes only to the new session table and preserves existing profile data", async ({ browser }) => {
  test.setTimeout(60000);
  expect(SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
  expect(ADMIN_PASSWORD.length).toBeGreaterThanOrEqual(16);
  expect(DATABASE_URL.length).toBeGreaterThan(0);

  const sql = postgres(DATABASE_URL, { max: 1 });
  try {
    await ensureActivityTable(sql);
    await sql`delete from app_user_sessions where profile_id in (${ACTIVITY_USER.profileId}::uuid, ${UNRELATED_USER.profileId}::uuid)`;
    await sql`delete from profiles where id in (${ACTIVITY_USER.profileId}::uuid, ${UNRELATED_USER.profileId}::uuid)`;
    await sql`
      insert into profiles (id, device_key, auth_user_id, updated_at)
      values
        (${ACTIVITY_USER.profileId}::uuid, ${ACTIVITY_USER.deviceKey}::uuid, ${ACTIVITY_USER.authUserId}::uuid, '2026-01-01T10:20:30Z'::timestamptz),
        (${UNRELATED_USER.profileId}::uuid, ${UNRELATED_USER.deviceKey}::uuid, ${UNRELATED_USER.authUserId}::uuid, '2026-02-02T11:22:33Z'::timestamptz)
    `;
  } finally {
    await sql.end();
  }

  const userContext = await signedInContext(browser, ACTIVITY_USER);
  const admin = await adminContext(browser);

  try {
    for (const [action, path] of [["start", "/dunnes"], ["page_view", "/profile"], ["heartbeat", "/profile"], ["end", "/profile"]]) {
      const response = await userContext.request.post(`${BASE_URL}/api/activity-session`, {
        headers: { origin: BASE_URL, "content-type": "application/json" },
        data: { action, sessionId: ACTIVITY_SESSION_ID, path },
      });
      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({ ok: true, tracked: true });
    }

    const verifySql = postgres(DATABASE_URL, { max: 1 });
    try {
      const [session] = await verifySql`
        select profile_id::text as profile_id, page_views::int as page_views, last_path, ended_at
        from app_user_sessions where id = ${ACTIVITY_SESSION_ID}::uuid
      `;
      expect(session?.profile_id).toBe(ACTIVITY_USER.profileId);
      expect(session?.page_views).toBe(2);
      expect(session?.last_path).toBe("/profile");
      expect(session?.ended_at).not.toBeNull();

      const profiles = await verifySql`
        select id::text as id, to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS') as updated_at
        from profiles
        where id in (${ACTIVITY_USER.profileId}::uuid, ${UNRELATED_USER.profileId}::uuid)
        order by id
      `;
      const activityProfile = profiles.find((row) => row.id === ACTIVITY_USER.profileId);
      const unrelatedProfile = profiles.find((row) => row.id === UNRELATED_USER.profileId);
      expect(activityProfile?.updated_at).toBe("2026-01-01 10:20:30");
      expect(unrelatedProfile?.updated_at).toBe("2026-02-02 11:22:33");

      const [unrelatedSessions] = await verifySql`
        select count(*)::int as count from app_user_sessions where profile_id = ${UNRELATED_USER.profileId}::uuid
      `;
      expect(unrelatedSessions?.count).toBe(0);
    } finally {
      await verifySql.end();
    }

    const activityResponse = await admin.request.get(`${BASE_URL}/api/admin/user-activity`);
    expect(activityResponse.status()).toBe(200);
    const activity = await activityResponse.json();
    expect(activity.summary.total_sessions).toBeGreaterThanOrEqual(1);
    expect(activity.recent.some((session) => session.session_id === ACTIVITY_SESSION_ID)).toBe(true);
  } finally {
    await userContext.close();
    await admin.close();
    const cleanupSql = postgres(DATABASE_URL, { max: 1 });
    try {
      await cleanupSql`delete from app_user_sessions where profile_id in (${ACTIVITY_USER.profileId}::uuid, ${UNRELATED_USER.profileId}::uuid)`;
      await cleanupSql`delete from profiles where id in (${ACTIVITY_USER.profileId}::uuid, ${UNRELATED_USER.profileId}::uuid)`;
    } finally {
      await cleanupSql.end();
    }
  }
});

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
const VOUCHER_ID = "37373737-3737-4737-8737-373737373737";
const IMAGE_DATA = `data:image/png;base64,${Buffer.from("admin-used-confirmation-voucher").toString("base64")}`;

function userToken(secret, user) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 30 * 24 * 60 * 60 * 1000;
  const payload = `${user.authUserId}.${user.profileId}.${issuedAt}.${expiresAt}`;
  const signature = crypto
    .createHmac("sha256", `couponshare-auth-session-v1:${secret}`)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

function adminToken(password) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 30 * 24 * 60 * 60 * 1000;
  const payload = `${issuedAt}.${expiresAt}`;
  const signature = crypto
    .createHmac("sha256", password)
    .update(`couponshare-admin-session-v1.${payload}`)
    .digest("base64url");
  return `${payload}.${signature}`;
}

async function signedInContext(browser, user) {
  const context = await browser.newContext();
  await context.addCookies([{
    name: "couponshare_user_v1",
    value: userToken(SESSION_SECRET, user),
    url: BASE_URL,
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
  }]);
  return context;
}

async function adminContext(browser) {
  const context = await browser.newContext();
  await context.addCookies([{
    name: "couponshare_admin_v1",
    value: adminToken(ADMIN_PASSWORD),
    url: BASE_URL,
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
  }]);
  return context;
}

test("user completion becomes owner-confirmation pending and admin can finalize it as used", async ({ browser }) => {
  test.setTimeout(60000);
  expect(SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
  expect(ADMIN_PASSWORD.length).toBeGreaterThanOrEqual(16);
  expect(DATABASE_URL.length).toBeGreaterThan(0);

  const sql = postgres(DATABASE_URL, { max: 1 });
  try {
    await sql`delete from dunnes_daily_reservations where profile_id in (${OWNER.profileId}::uuid, ${RESERVER.profileId}::uuid)`;
    await sql`delete from dunnes_vouchers where id = ${VOUCHER_ID}::uuid or owner_id in (${OWNER.profileId}::uuid, ${RESERVER.profileId}::uuid) or reserved_by in (${OWNER.profileId}::uuid, ${RESERVER.profileId}::uuid)`;
    await sql`delete from profiles where id in (${OWNER.profileId}::uuid, ${RESERVER.profileId}::uuid)`;

    for (const user of [OWNER, RESERVER]) {
      await sql`
        insert into profiles (id, device_key, auth_user_id, updated_at)
        values (${user.profileId}::uuid, ${user.deviceKey}::uuid, ${user.authUserId}::uuid, now())
      `;
    }

    await sql`
      insert into dunnes_vouchers (
        id, owner_id, voucher_type, barcode, image_data, membership_required,
        expires_on, status, review_status, reserved_by, reserved_at, used_at
      ) values (
        ${VOUCHER_ID}::uuid,
        ${OWNER.profileId}::uuid,
        '10off40',
        '2708888888401',
        ${IMAGE_DATA},
        false,
        '2099-09-06',
        'reserved',
        'approved',
        ${RESERVER.profileId}::uuid,
        now(),
        null
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
    expect(completion.body.status).toBe("owner_confirmation");

    let verifySql = postgres(DATABASE_URL, { max: 1 });
    try {
      const [pending] = await verifySql`
        select status, reserved_by::text as reserved_by, reserved_at, used_at
        from dunnes_vouchers
        where id = ${VOUCHER_ID}::uuid
      `;
      expect(pending?.status).toBe("reserved");
      expect(pending?.reserved_by).toBeNull();
      expect(pending?.reserved_at).toBeNull();
      expect(pending?.used_at).toBeNull();
    } finally {
      await verifySql.end();
    }

    const queueResponse = await admin.request.get(`${BASE_URL}/api/admin/dunnes-review-queue`);
    expect(queueResponse.status()).toBe(200);
    const queue = await queueResponse.json();
    const queueVoucher = queue.reviews.find((voucher) => voucher.voucher_id === VOUCHER_ID);
    expect(queueVoucher).toMatchObject({
      voucher_label: "€10 OFF €40",
      status: "reserved",
      usage_confirmation_pending: true,
    });

    const reservationResponse = await admin.request.get(`${BASE_URL}/api/admin/dunnes-reservations`);
    expect(reservationResponse.status()).toBe(200);
    const reservations = await reservationResponse.json();
    expect(reservations.reservations.some((voucher) => voucher.voucher_id === VOUCHER_ID)).toBe(false);

    const form = new URLSearchParams({
      action: "mark_dunnes_used",
      targetId: VOUCHER_ID,
    });
    const confirmResponse = await admin.request.post(`${BASE_URL}/api/admin/moderation`, {
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: BASE_URL,
      },
      data: form.toString(),
      maxRedirects: 0,
    });
    expect(confirmResponse.status()).toBe(303);

    verifySql = postgres(DATABASE_URL, { max: 1 });
    try {
      const [used] = await verifySql`
        select status, reserved_by::text as reserved_by, reserved_at, used_at
        from dunnes_vouchers
        where id = ${VOUCHER_ID}::uuid
      `;
      expect(used?.status).toBe("used");
      expect(used?.reserved_by).toBeNull();
      expect(used?.reserved_at).toBeNull();
      expect(used?.used_at).not.toBeNull();
    } finally {
      await verifySql.end();
    }

    const queueAfterResponse = await admin.request.get(`${BASE_URL}/api/admin/dunnes-review-queue`);
    expect(queueAfterResponse.status()).toBe(200);
    const queueAfter = await queueAfterResponse.json();
    expect(queueAfter.reviews.some((voucher) => voucher.voucher_id === VOUCHER_ID)).toBe(false);

    const ownerNotifications = await ownerContext.request.get(`${BASE_URL}/api/notifications`);
    expect(ownerNotifications.status()).toBe(200);
    const notifications = await ownerNotifications.json();
    expect(notifications.notifications.some((notification) => notification.voucher_id === VOUCHER_ID)).toBe(false);
  } finally {
    await reserverContext.close();
    await ownerContext.close();
    await admin.close();

    const cleanupSql = postgres(DATABASE_URL, { max: 1 });
    try {
      await cleanupSql`delete from dunnes_daily_reservations where profile_id in (${OWNER.profileId}::uuid, ${RESERVER.profileId}::uuid)`;
      await cleanupSql`delete from dunnes_vouchers where id = ${VOUCHER_ID}::uuid or owner_id in (${OWNER.profileId}::uuid, ${RESERVER.profileId}::uuid) or reserved_by in (${OWNER.profileId}::uuid, ${RESERVER.profileId}::uuid)`;
      await cleanupSql`delete from profiles where id in (${OWNER.profileId}::uuid, ${RESERVER.profileId}::uuid)`;
    } finally {
      await cleanupSql.end();
    }
  }
});

import crypto from "node:crypto";
import postgres from "postgres";
import { test, expect } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const SESSION_SECRET = process.env.CI_AUTH_SESSION_SECRET ?? "";
const DATABASE_URL = process.env.DATABASE_URL ?? "";

const OWNER = {
  profileId: "14141414-1414-4141-8141-141414141414",
  deviceKey: "15151515-1515-4151-8151-151515151515",
  authUserId: "16161616-1616-4161-8161-161616161616",
};
const RESERVER = {
  profileId: "17171717-1717-4171-8171-171717171717",
  deviceKey: "18181818-1818-4181-8181-181818181818",
  authUserId: "19191919-1919-4191-8191-191919191919",
};
const OBSERVER = {
  profileId: "20202020-2020-4202-8202-202020202020",
  deviceKey: "21212121-2121-4212-8212-212121212121",
  authUserId: "22222222-2222-4222-8222-222222222222",
};

const BARCODE = "2709999999401";
const IMAGE_DATA = `data:image/png;base64,${Buffer.from("reserved-visibility-voucher").toString("base64")}`;

function todayInDublin() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Dublin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

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

async function postDunnes(page, body) {
  return page.evaluate(async (payload) => {
    const response = await fetch("/api/dunnes-vouchers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });
    return { status: response.status, body: await response.text() };
  }, body);
}

async function assertReservedPublicCard(page) {
  const busyCard = page.locator(".dunnes-list-item.busy").filter({ hasText: "€10 OFF €40" });
  await expect(busyCard).toBeVisible();
  await expect(busyCard).toContainText("예약 중");
  await expect(busyCard.locator("button")).toHaveText("예약 중");
  await expect(busyCard.locator("button")).toBeDisabled();
}

test("A registers, B reserves, and other users still see the approved voucher as reserved", async ({ browser }) => {
  test.setTimeout(60000);
  expect(SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
  expect(DATABASE_URL.length).toBeGreaterThan(0);
  const expiry = todayInDublin();

  const sql = postgres(DATABASE_URL, { max: 1 });
  try {
    for (const user of [OWNER, RESERVER, OBSERVER]) {
      await sql`delete from dunnes_daily_reservations where profile_id = ${user.profileId}::uuid`;
      await sql`delete from api_rate_limits where profile_id = ${user.profileId}::uuid`;
      await sql`delete from dunnes_vouchers where owner_id = ${user.profileId}::uuid or reserved_by = ${user.profileId}::uuid`;
      await sql`delete from profiles where id = ${user.profileId}::uuid`;
    }
    for (const user of [OWNER, RESERVER, OBSERVER]) {
      await sql`
        insert into profiles (id, device_key, auth_user_id, updated_at)
        values (${user.profileId}::uuid, ${user.deviceKey}::uuid, ${user.authUserId}::uuid, now())
      `;
    }
  } finally {
    await sql.end();
  }

  const ownerContext = await signedInContext(browser, OWNER);
  const reserverContext = await signedInContext(browser, RESERVER);
  const observerContext = await signedInContext(browser, OBSERVER);
  const guestContext = await browser.newContext();

  try {
    const ownerPage = await ownerContext.newPage();
    await ownerPage.goto(`${BASE_URL}/dunnes`, { waitUntil: "domcontentloaded" });
    const uploaded = await postDunnes(ownerPage, {
      action: "upload",
      voucherType: "10off40",
      barcode: BARCODE,
      imageData: IMAGE_DATA,
      membershipRequired: false,
      membershipImageData: null,
      expiresOn: expiry,
    });
    expect(uploaded.status, uploaded.body).toBe(200);

    let verifySql = postgres(DATABASE_URL, { max: 1 });
    let voucherId = "";
    try {
      const [voucher] = await verifySql`
        select id::text as id, status, review_status, expires_on::text as expires_on
        from dunnes_vouchers
        where owner_id = ${OWNER.profileId}::uuid and barcode = ${BARCODE}
      `;
      expect(voucher?.status).toBe("available");
      expect(voucher?.review_status).toBe("approved");
      expect(voucher?.expires_on).toBe(expiry);
      voucherId = voucher?.id ?? "";
      expect(voucherId).not.toBe("");
    } finally {
      await verifySql.end();
    }

    const reserverPage = await reserverContext.newPage();
    await reserverPage.goto(`${BASE_URL}/dunnes`, { waitUntil: "domcontentloaded" });
    const reserved = await postDunnes(reserverPage, { action: "reserve", voucherId });
    expect(reserved.status, reserved.body).toBe(200);

    verifySql = postgres(DATABASE_URL, { max: 1 });
    try {
      const [voucher] = await verifySql`
        select status, review_status, reserved_by::text as reserved_by, reserved_at
        from dunnes_vouchers
        where id = ${voucherId}::uuid
      `;
      expect(voucher?.status).toBe("reserved");
      expect(voucher?.review_status).toBe("approved");
      expect(voucher?.reserved_by).toBe(RESERVER.profileId);
      expect(voucher?.reserved_at).not.toBeNull();
    } finally {
      await verifySql.end();
    }

    await ownerPage.reload({ waitUntil: "domcontentloaded" });
    const ownerCard = ownerPage.locator(".dunnes-list-item.mine").filter({ hasText: "€10 OFF €40" });
    await expect(ownerCard).toBeVisible();
    await expect(ownerPage.locator(".owner-reservation-status")).toContainText("€10 OFF €40");
    await expect(ownerPage.locator(".owner-reservation-status")).toContainText("예약 중");

    await reserverPage.reload({ waitUntil: "domcontentloaded" });
    await expect(reserverPage.locator(".dunnes-reserved")).toContainText("€10 OFF €40");

    const observerPage = await observerContext.newPage();
    await observerPage.goto(`${BASE_URL}/dunnes`, { waitUntil: "domcontentloaded" });

    const observerState = await observerPage.evaluate(async () => {
      const response = await fetch("/api/dunnes-vouchers", { cache: "no-store", credentials: "same-origin" });
      return { status: response.status, body: await response.json() };
    });
    expect(observerState.status).toBe(200);
    const observerVoucher = observerState.body.vouchers.find((voucher) => voucher.barcode_masked.endsWith("9401"));
    expect(observerVoucher).toMatchObject({
      status: "reserved",
      review_status: "approved",
      is_mine: false,
      reserved_by_me: false,
      image_data: null,
      membership_image_data: null,
    });
    expect(observerVoucher.expires_on).toBe(expiry);
    await assertReservedPublicCard(observerPage);

    const guestPage = await guestContext.newPage();
    await guestPage.goto(`${BASE_URL}/dunnes`, { waitUntil: "domcontentloaded" });
    await assertReservedPublicCard(guestPage);
  } finally {
    await ownerContext.close();
    await reserverContext.close();
    await observerContext.close();
    await guestContext.close();

    const cleanupSql = postgres(DATABASE_URL, { max: 1 });
    try {
      await cleanupSql`delete from dunnes_daily_reservations where profile_id in (${OWNER.profileId}::uuid, ${RESERVER.profileId}::uuid, ${OBSERVER.profileId}::uuid)`;
      await cleanupSql`delete from api_rate_limits where profile_id in (${OWNER.profileId}::uuid, ${RESERVER.profileId}::uuid, ${OBSERVER.profileId}::uuid)`;
      await cleanupSql`delete from dunnes_vouchers where owner_id in (${OWNER.profileId}::uuid, ${RESERVER.profileId}::uuid, ${OBSERVER.profileId}::uuid) or reserved_by in (${OWNER.profileId}::uuid, ${RESERVER.profileId}::uuid, ${OBSERVER.profileId}::uuid)`;
      await cleanupSql`delete from profiles where id in (${OWNER.profileId}::uuid, ${RESERVER.profileId}::uuid, ${OBSERVER.profileId}::uuid)`;
    } finally {
      await cleanupSql.end();
    }
  }
});
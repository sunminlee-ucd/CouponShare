import crypto from "node:crypto";
import postgres from "postgres";
import { test, expect } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const SESSION_SECRET = process.env.CI_AUTH_SESSION_SECRET ?? "";
const ADMIN_PASSWORD = process.env.CI_ADMIN_PASSWORD ?? "";
const DATABASE_URL = process.env.DATABASE_URL ?? "";
const PROFILE_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const DEVICE_KEY = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const AUTH_USER_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const TEST_BARCODES = [
  "2709999999901",
  "2709999999902",
  "2709999999903",
  "2709999999904",
  "2709999999905",
];

function userToken(secret) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 30 * 24 * 60 * 60 * 1000;
  const payload = `${AUTH_USER_ID}.${PROFILE_ID}.${issuedAt}.${expiresAt}`;
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

function imageDataFor(index) {
  return `data:image/png;base64,${Buffer.from(`voucher-${index}`).toString("base64")}`;
}

async function uploadVoucher(page, payload) {
  return page.evaluate(async (body) => {
    const response = await fetch("/api/dunnes-vouchers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.text() };
  }, payload);
}

test("Dunnes registration auto-approves valid uploads, counts only successes, and supports admin follow-up review", async ({ page, context }) => {
  test.setTimeout(60000);
  expect(SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
  expect(ADMIN_PASSWORD.length).toBeGreaterThanOrEqual(16);
  expect(DATABASE_URL.length).toBeGreaterThan(0);

  const sql = postgres(DATABASE_URL, { max: 1 });
  try {
    await sql`
      create table if not exists api_rate_limits (
        profile_id uuid not null references profiles(id) on delete cascade,
        action text not null,
        window_start timestamptz not null,
        request_count integer not null default 0 check (request_count >= 0),
        updated_at timestamptz not null default now(),
        primary key (profile_id, action, window_start)
      )
    `;
    await sql`delete from api_rate_limits where profile_id = ${PROFILE_ID}::uuid`;
    await sql`delete from dunnes_vouchers where owner_id = ${PROFILE_ID}::uuid`;
    await sql`delete from profiles where id = ${PROFILE_ID}::uuid`;
    await sql`
      insert into profiles (id, device_key, auth_user_id, updated_at)
      values (${PROFILE_ID}::uuid, ${DEVICE_KEY}::uuid, ${AUTH_USER_ID}::uuid, now())
    `;
  } finally {
    await sql.end();
  }

  await context.addCookies([{
    name: "couponshare_user_v1",
    value: userToken(SESSION_SECRET),
    url: BASE_URL,
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
  }]);

  await page.goto(`${BASE_URL}/dunnes`, { waitUntil: "domcontentloaded" });

  const invalidAttempt = await uploadVoucher(page, {
    action: "upload",
    voucherType: "5off25",
    barcode: "123",
    imageData: imageDataFor(0),
    membershipRequired: false,
    membershipImageData: null,
    expiresOn: "2099-09-04",
  });
  expect(invalidAttempt.status, invalidAttempt.body).toBe(400);

  let verifySql = postgres(DATABASE_URL, { max: 1 });
  try {
    const usageAfterFailure = await verifySql`
      select request_count
      from api_rate_limits
      where profile_id = ${PROFILE_ID}::uuid and action = 'dunnes:upload'
    `;
    expect(usageAfterFailure).toHaveLength(0);
  } finally {
    await verifySql.end();
  }

  for (const [index, barcode] of TEST_BARCODES.entries()) {
    const result = await uploadVoucher(page, {
      action: "upload",
      voucherType: index % 2 === 0 ? "5off25" : "10off40",
      barcode,
      imageData: imageDataFor(index + 1),
      membershipRequired: false,
      membershipImageData: null,
      expiresOn: "2099-09-04",
    });
    expect(result.status, result.body).toBe(200);
    expect(result.body).toContain(barcode.slice(-4));
  }

  verifySql = postgres(DATABASE_URL, { max: 1 });
  let firstVoucherId = "";
  try {
    const rows = await verifySql`
      select id::text as id, barcode, review_status, status, expires_on::text as expires_on
      from dunnes_vouchers
      where owner_id = ${PROFILE_ID}::uuid
      order by barcode
    `;
    expect(rows).toHaveLength(5);
    expect(rows.every((row) => row.review_status === "approved")).toBe(true);
    expect(rows.every((row) => row.status === "available")).toBe(true);
    firstVoucherId = rows[0].id;

    const [usage] = await verifySql`
      select request_count
      from api_rate_limits
      where profile_id = ${PROFILE_ID}::uuid and action = 'dunnes:upload'
    `;
    expect(Number(usage?.request_count)).toBe(5);
  } finally {
    await verifySql.end();
  }

  const duplicateAttempt = await uploadVoucher(page, {
    action: "upload",
    voucherType: "5off25",
    barcode: TEST_BARCODES[0],
    imageData: imageDataFor(1),
    membershipRequired: false,
    membershipImageData: null,
    expiresOn: "2099-09-04",
  });
  expect(duplicateAttempt.status, duplicateAttempt.body).toBe(409);

  verifySql = postgres(DATABASE_URL, { max: 1 });
  try {
    const [usage] = await verifySql`
      select request_count
      from api_rate_limits
      where profile_id = ${PROFILE_ID}::uuid and action = 'dunnes:upload'
    `;
    expect(Number(usage?.request_count)).toBe(5);
  } finally {
    await verifySql.end();
  }

  await context.addCookies([{
    name: "couponshare_admin_v1",
    value: adminToken(ADMIN_PASSWORD),
    url: BASE_URL,
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
  }]);

  const expiryResponse = await context.request.post(`${BASE_URL}/api/admin/moderation`, {
    headers: { origin: BASE_URL },
    form: {
      action: "update_dunnes_expiry",
      targetId: firstVoucherId,
      expiresOn: "2099-10-01",
    },
    maxRedirects: 0,
  });
  expect(expiryResponse.status()).toBe(303);

  verifySql = postgres(DATABASE_URL, { max: 1 });
  try {
    const [updated] = await verifySql`
      select expires_on::text as expires_on, status, review_status
      from dunnes_vouchers
      where id = ${firstVoucherId}::uuid
    `;
    expect(updated.expires_on).toBe("2099-10-01");
    expect(updated.status).toBe("available");
    expect(updated.review_status).toBe("approved");
  } finally {
    await verifySql.end();
  }

  const rejectResponse = await context.request.post(`${BASE_URL}/api/admin/moderation`, {
    headers: { origin: BASE_URL },
    form: {
      action: "reject_dunnes",
      targetId: firstVoucherId,
    },
    maxRedirects: 0,
  });
  expect(rejectResponse.status()).toBe(303);

  verifySql = postgres(DATABASE_URL, { max: 1 });
  try {
    const [rejected] = await verifySql`
      select status, review_status, reserved_by, reserved_at
      from dunnes_vouchers
      where id = ${firstVoucherId}::uuid
    `;
    expect(rejected.status).toBe("rejected");
    expect(rejected.review_status).toBe("rejected");
    expect(rejected.reserved_by).toBeNull();
    expect(rejected.reserved_at).toBeNull();
  } finally {
    await verifySql.end();
  }

  const sixthAttempt = await uploadVoucher(page, {
    action: "upload",
    voucherType: "5off25",
    barcode: "2709999999906",
    imageData: imageDataFor(6),
    membershipRequired: false,
    membershipImageData: null,
    expiresOn: "2099-09-04",
  });
  expect(sixthAttempt.status, sixthAttempt.body).toBe(429);

  verifySql = postgres(DATABASE_URL, { max: 1 });
  try {
    const [usage] = await verifySql`
      select request_count
      from api_rate_limits
      where profile_id = ${PROFILE_ID}::uuid and action = 'dunnes:upload'
    `;
    expect(Number(usage?.request_count)).toBe(5);
    const activeRows = await verifySql`
      select id from dunnes_vouchers
      where owner_id = ${PROFILE_ID}::uuid and status in ('available', 'reserved')
    `;
    expect(activeRows).toHaveLength(4);

    await verifySql`delete from api_rate_limits where profile_id = ${PROFILE_ID}::uuid`;
    await verifySql`delete from dunnes_vouchers where owner_id = ${PROFILE_ID}::uuid`;
    await verifySql`delete from profiles where id = ${PROFILE_ID}::uuid`;
  } finally {
    await verifySql.end();
  }
});

import crypto from "node:crypto";
import postgres from "postgres";
import { test, expect } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const SESSION_SECRET = process.env.CI_AUTH_SESSION_SECRET ?? "";
const DATABASE_URL = process.env.DATABASE_URL ?? "";
const PROFILE_ID = "67676767-6767-4676-8676-676767676767";
const DEVICE_KEY = "78787878-7878-4787-8787-787878787878";
const AUTH_USER_ID = "89898989-8989-4898-8989-898989898989";
const LEGACY_VOUCHER_ID = "90909090-9090-4909-8909-909090909090";
const BARCODE = "2709999999701";

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

function imageData() {
  return `data:image/png;base64,${Buffer.from("legacy-cancelled-voucher").toString("base64")}`;
}

async function uploadVoucher(page) {
  return page.evaluate(async ({ barcode, image }) => {
    const response = await fetch("/api/dunnes-vouchers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        action: "upload",
        voucherType: "5off25",
        barcode,
        imageData: image,
        membershipRequired: false,
        membershipImageData: null,
        expiresOn: "2099-09-04",
      }),
    });
    return { status: response.status, body: await response.text() };
  }, { barcode: BARCODE, image: imageData() });
}

test("legacy owner-cancelled unused voucher can be re-registered while used history remains blocked", async ({ page, context }) => {
  test.setTimeout(45000);
  expect(SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
  expect(DATABASE_URL.length).toBeGreaterThan(0);

  let sql = postgres(DATABASE_URL, { max: 1 });
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
    await sql`
      insert into dunnes_vouchers (
        id,
        owner_id,
        voucher_type,
        barcode,
        image_data,
        membership_required,
        membership_image_data,
        expires_on,
        status,
        review_status,
        used_at
      ) values (
        ${LEGACY_VOUCHER_ID}::uuid,
        ${PROFILE_ID}::uuid,
        '5off25',
        ${BARCODE},
        ${imageData()},
        false,
        null,
        '2099-09-04',
        'rejected',
        'rejected',
        null
      )
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

  const retry = await uploadVoucher(page);
  expect(retry.status, retry.body).toBe(200);
  expect(retry.body).toContain(BARCODE.slice(-4));

  sql = postgres(DATABASE_URL, { max: 1 });
  let currentVoucherId = "";
  try {
    const rows = await sql`
      select id::text as id, status, review_status, used_at
      from dunnes_vouchers
      where barcode = ${BARCODE}
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0].id).not.toBe(LEGACY_VOUCHER_ID);
    expect(rows[0].status).toBe("available");
    expect(rows[0].review_status).toBe("approved");
    expect(rows[0].used_at).toBeNull();
    currentVoucherId = rows[0].id;

    const [usage] = await sql`
      select request_count
      from api_rate_limits
      where profile_id = ${PROFILE_ID}::uuid and action = 'dunnes:upload'
    `;
    expect(Number(usage?.request_count)).toBe(1);

    await sql`
      update dunnes_vouchers
      set status = 'used', used_at = now(), updated_at = now()
      where id = ${currentVoucherId}::uuid
    `;
  } finally {
    await sql.end();
  }

  const usedRetry = await uploadVoucher(page);
  expect(usedRetry.status, usedRetry.body).toBe(409);
  expect(usedRetry.body).toContain("duplicate");

  sql = postgres(DATABASE_URL, { max: 1 });
  try {
    const [usedVoucher] = await sql`
      select id::text as id, status, used_at
      from dunnes_vouchers
      where barcode = ${BARCODE}
    `;
    expect(usedVoucher?.id).toBe(currentVoucherId);
    expect(usedVoucher?.status).toBe("used");
    expect(usedVoucher?.used_at).not.toBeNull();

    const [usage] = await sql`
      select request_count
      from api_rate_limits
      where profile_id = ${PROFILE_ID}::uuid and action = 'dunnes:upload'
    `;
    expect(Number(usage?.request_count)).toBe(1);

    await sql`delete from api_rate_limits where profile_id = ${PROFILE_ID}::uuid`;
    await sql`delete from dunnes_vouchers where owner_id = ${PROFILE_ID}::uuid`;
    await sql`delete from profiles where id = ${PROFILE_ID}::uuid`;
  } finally {
    await sql.end();
  }
});

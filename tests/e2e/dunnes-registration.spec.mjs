import crypto from "node:crypto";
import postgres from "postgres";
import { test, expect } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const SESSION_SECRET = process.env.CI_AUTH_SESSION_SECRET ?? "";
const DATABASE_URL = process.env.DATABASE_URL ?? "";
const PROFILE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AUTH_USER_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const TEST_BARCODE = "2709999999999";

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

test("signed-in user can register a Dunnes voucher through the production route", async ({ page, context }) => {
  test.setTimeout(45000);
  expect(SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
  expect(DATABASE_URL.length).toBeGreaterThan(0);

  const sql = postgres(DATABASE_URL, { max: 1 });
  try {
    await sql`
      update profiles
      set auth_user_id = ${AUTH_USER_ID}::uuid, updated_at = now()
      where id = ${PROFILE_ID}::uuid
    `;
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
    await sql`delete from api_rate_limits where profile_id = ${PROFILE_ID}::uuid and action = 'dunnes:upload'`;
    await sql`delete from dunnes_vouchers where barcode = ${TEST_BARCODE}`;
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

  const result = await page.evaluate(async ({ barcode }) => {
    const imageData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL6WQAAAABJRU5ErkJggg==";
    const response = await fetch("/api/dunnes-vouchers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        action: "upload",
        voucherType: "5off25",
        barcode,
        imageData,
        membershipRequired: false,
        membershipImageData: null,
        expiresOn: "2099-09-04",
      }),
    });
    return { status: response.status, body: await response.text() };
  }, { barcode: TEST_BARCODE });

  expect(result.status, result.body).toBe(200);
  expect(result.body).toContain("9999");

  const verifySql = postgres(DATABASE_URL, { max: 1 });
  try {
    const rows = await verifySql`
      select barcode, owner_id::text as owner_id
      from dunnes_vouchers
      where barcode = ${TEST_BARCODE}
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0].owner_id).toBe(PROFILE_ID);
    await verifySql`delete from dunnes_vouchers where barcode = ${TEST_BARCODE}`;
    await verifySql`delete from api_rate_limits where profile_id = ${PROFILE_ID}::uuid and action = 'dunnes:upload'`;
  } finally {
    await verifySql.end();
  }
});

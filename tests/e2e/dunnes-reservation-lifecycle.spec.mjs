import crypto from "node:crypto";
import postgres from "postgres";
import { test, expect } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const ADMIN_PASSWORD = process.env.CI_ADMIN_PASSWORD ?? "";
const DATABASE_URL = process.env.DATABASE_URL ?? "";

const OWNER_ID = "61616161-6161-4161-8161-616161616161";
const OWNER_DEVICE = "62626262-6262-4262-8262-626262626262";
const RESERVER_ID = "63636363-6363-4363-8363-636363636363";
const RESERVER_DEVICE = "64646464-6464-4464-8464-646464646464";

const EXPIRED_ID = "65656565-6565-4565-8565-656565656565";
const TIMEOUT_ID = "66666666-6666-4666-8666-666666666666";
const ACTIVE_ID = "67676767-6767-4767-8767-676767676767";
const LEGACY_LOCK_ID = "68686868-6868-4868-8868-686868686868";
const OWNER_CONFIRM_ID = "69696969-6969-4969-8969-696969696969";
const USED_ID = "70707070-7070-4070-8070-707070707070";
const UNRELATED_ID = "71717171-7171-4171-8171-717171717171";

function adminToken(password) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 30 * 24 * 60 * 60 * 1000;
  const payload = `${issuedAt}.${expiresAt}`;
  const signature = crypto.createHmac("sha256", password).update(`couponshare-admin-session-v1.${payload}`).digest("base64url");
  return `${payload}.${signature}`;
}

async function seed(sql) {
  await sql`delete from dunnes_vouchers where owner_id = ${OWNER_ID}::uuid or reserved_by = ${RESERVER_ID}::uuid`;
  await sql`delete from profiles where id in (${OWNER_ID}::uuid, ${RESERVER_ID}::uuid)`;
  await sql`
    insert into profiles (id, device_key, updated_at)
    values
      (${OWNER_ID}::uuid, ${OWNER_DEVICE}::uuid, now()),
      (${RESERVER_ID}::uuid, ${RESERVER_DEVICE}::uuid, now())
  `;

  await sql`
    insert into dunnes_vouchers (
      id, owner_id, voucher_type, barcode, image_data, membership_required,
      expires_on, status, review_status, reserved_by, reserved_at, used_at, updated_at
    ) values
      (${EXPIRED_ID}::uuid, ${OWNER_ID}::uuid, '10off40', '2709000000001', 'data:image/png;base64,QQ==', false,
        (now() at time zone 'Europe/Dublin')::date - 1, 'reserved', 'approved', ${RESERVER_ID}::uuid, now() - interval '5 minutes', null, now() - interval '5 minutes'),
      (${TIMEOUT_ID}::uuid, ${OWNER_ID}::uuid, '10off40', '2709000000002', 'data:image/png;base64,Qg==', false,
        (now() at time zone 'Europe/Dublin')::date + 1, 'reserved', 'approved', ${RESERVER_ID}::uuid, now() - interval '30 minutes', null, now() - interval '30 minutes'),
      (${ACTIVE_ID}::uuid, ${OWNER_ID}::uuid, '10off40', '2709000000003', 'data:image/png;base64,Qw==', false,
        (now() at time zone 'Europe/Dublin')::date + 1, 'reserved', 'approved', ${RESERVER_ID}::uuid, now() - interval '29 minutes', null, now() - interval '29 minutes'),
      (${LEGACY_LOCK_ID}::uuid, ${OWNER_ID}::uuid, '5off25', '2709000000004', 'data:image/png;base64,RA==', false,
        (now() at time zone 'Europe/Dublin')::date + 1, 'reserved', 'approved', ${RESERVER_ID}::uuid, null, null, now() - interval '31 minutes'),
      (${OWNER_CONFIRM_ID}::uuid, ${OWNER_ID}::uuid, '5off25', '2709000000005', 'data:image/png;base64,RQ==', false,
        (now() at time zone 'Europe/Dublin')::date + 1, 'reserved', 'approved', null, null, null, now() - interval '31 minutes'),
      (${USED_ID}::uuid, ${OWNER_ID}::uuid, '5off25', '2709000000006', 'data:image/png;base64,Rg==', false,
        (now() at time zone 'Europe/Dublin')::date + 1, 'used', 'approved', ${RESERVER_ID}::uuid, now() - interval '40 minutes', now() - interval '10 minutes', now() - interval '10 minutes'),
      (${UNRELATED_ID}::uuid, ${OWNER_ID}::uuid, '5off25', '2709000000007', 'data:image/png;base64,Rw==', false,
        (now() at time zone 'Europe/Dublin')::date + 2, 'available', 'approved', null, null, null, '2026-01-02T03:04:05Z'::timestamptz)
  `;
}

test("admin read expires old vouchers and releases reservations at 30 minutes without touching completed or unrelated data", async ({ browser }) => {
  test.setTimeout(60000);
  expect(ADMIN_PASSWORD.length).toBeGreaterThanOrEqual(16);
  expect(DATABASE_URL.length).toBeGreaterThan(0);

  const sql = postgres(DATABASE_URL, { max: 1 });
  try {
    await seed(sql);
  } finally {
    await sql.end();
  }

  const admin = await browser.newContext();
  await admin.addCookies([{ name: "couponshare_admin_v1", value: adminToken(ADMIN_PASSWORD), url: BASE_URL, httpOnly: true, secure: false, sameSite: "Lax" }]);

  try {
    const response = await admin.request.get(`${BASE_URL}/api/admin/dunnes-reservations`);
    expect(response.status()).toBe(200);
    const payload = await response.json();
    const ids = payload.reservations.map((row) => row.voucher_id);

    expect(ids).toContain(ACTIVE_ID);
    expect(ids).not.toContain(EXPIRED_ID);
    expect(ids).not.toContain(TIMEOUT_ID);
    expect(ids).not.toContain(LEGACY_LOCK_ID);
    expect(ids).not.toContain(OWNER_CONFIRM_ID);
    expect(ids).not.toContain(USED_ID);

    const verifySql = postgres(DATABASE_URL, { max: 1 });
    try {
      const rows = await verifySql`
        select id::text as id, status, reserved_by::text as reserved_by, reserved_at, used_at,
               to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS') as updated_at
        from dunnes_vouchers
        where id in (
          ${EXPIRED_ID}::uuid, ${TIMEOUT_ID}::uuid, ${ACTIVE_ID}::uuid,
          ${LEGACY_LOCK_ID}::uuid, ${OWNER_CONFIRM_ID}::uuid, ${USED_ID}::uuid, ${UNRELATED_ID}::uuid
        )
      `;
      const byId = new Map(rows.map((row) => [row.id, row]));

      expect(byId.get(EXPIRED_ID)?.status).toBe("expired");
      expect(byId.get(EXPIRED_ID)?.reserved_by).toBeNull();
      expect(byId.get(EXPIRED_ID)?.reserved_at).toBeNull();

      expect(byId.get(TIMEOUT_ID)?.status).toBe("available");
      expect(byId.get(TIMEOUT_ID)?.reserved_by).toBeNull();
      expect(byId.get(TIMEOUT_ID)?.reserved_at).toBeNull();

      expect(byId.get(LEGACY_LOCK_ID)?.status).toBe("available");
      expect(byId.get(LEGACY_LOCK_ID)?.reserved_by).toBeNull();
      expect(byId.get(LEGACY_LOCK_ID)?.reserved_at).toBeNull();

      expect(byId.get(ACTIVE_ID)?.status).toBe("reserved");
      expect(byId.get(ACTIVE_ID)?.reserved_by).toBe(RESERVER_ID);
      expect(byId.get(ACTIVE_ID)?.reserved_at).not.toBeNull();

      expect(byId.get(OWNER_CONFIRM_ID)?.status).toBe("reserved");
      expect(byId.get(OWNER_CONFIRM_ID)?.reserved_by).toBeNull();
      expect(byId.get(OWNER_CONFIRM_ID)?.reserved_at).toBeNull();

      expect(byId.get(USED_ID)?.status).toBe("used");
      expect(byId.get(USED_ID)?.used_at).not.toBeNull();
      expect(byId.get(USED_ID)?.reserved_by).toBe(RESERVER_ID);

      expect(byId.get(UNRELATED_ID)?.status).toBe("available");
      expect(byId.get(UNRELATED_ID)?.updated_at).toBe("2026-01-02 03:04:05");
    } finally {
      await verifySql.end();
    }

    const reviewResponse = await admin.request.get(`${BASE_URL}/api/admin/dunnes-review-queue`);
    expect(reviewResponse.status()).toBe(200);
    const reviewPayload = await reviewResponse.json();
    expect(reviewPayload.reviews.some((row) => row.voucher_id === EXPIRED_ID)).toBe(false);
  } finally {
    await admin.close();
    const cleanupSql = postgres(DATABASE_URL, { max: 1 });
    try {
      await cleanupSql`delete from dunnes_vouchers where owner_id = ${OWNER_ID}::uuid or reserved_by = ${RESERVER_ID}::uuid`;
      await cleanupSql`delete from profiles where id in (${OWNER_ID}::uuid, ${RESERVER_ID}::uuid)`;
    } finally {
      await cleanupSql.end();
    }
  }
});

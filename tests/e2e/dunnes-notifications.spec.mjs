import crypto from "node:crypto";
import postgres from "postgres";
import { test, expect } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const SESSION_SECRET = process.env.CI_AUTH_SESSION_SECRET ?? "";
const DATABASE_URL = process.env.DATABASE_URL ?? "";

const OWNER = {
  profileId: "81818181-8181-4181-8181-818181818181",
  deviceKey: "82828282-8282-4282-8282-828282828282",
  authUserId: "83838383-8383-4383-8383-838383838383",
};
const RESERVER = {
  profileId: "84848484-8484-4484-8484-848484848484",
  deviceKey: "85858585-8585-4585-8585-858585858585",
  authUserId: "86868686-8686-4686-8686-868686868686",
};
const FLOW_VOUCHER_ID = "87878787-8787-4787-8787-878787878787";
const TODAY_VOUCHER_ID = "88888888-8888-4888-8888-888888888888";
const FUTURE_VOUCHER_ID = "89898989-8989-4989-8989-898989898989";

function userToken(secret, user) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 30 * 24 * 60 * 60 * 1000;
  const payload = `${user.authUserId}.${user.profileId}.${issuedAt}.${expiresAt}`;
  const signature = crypto.createHmac("sha256", `couponshare-auth-session-v1:${secret}`).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

async function signedInContext(browser, user) {
  const context = await browser.newContext();
  await context.addCookies([{ name: "couponshare_user_v1", value: userToken(SESSION_SECRET, user), url: BASE_URL, httpOnly: true, secure: false, sameSite: "Lax" }]);
  return context;
}

async function prepareNotificationSchema(sql) {
  await sql`
    create table if not exists app_notifications (
      id uuid primary key default gen_random_uuid(),
      profile_id uuid not null references profiles(id) on delete cascade,
      voucher_id uuid references dunnes_vouchers(id) on delete cascade,
      notification_type text not null,
      dedupe_key text not null unique,
      read_at timestamptz,
      push_dispatched_at timestamptz,
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists web_push_subscriptions (
      id uuid primary key default gen_random_uuid(),
      profile_id uuid not null references profiles(id) on delete cascade,
      endpoint text not null unique,
      p256dh text not null,
      auth text not null,
      language text not null default 'ko',
      user_agent text,
      disabled_at timestamptz,
      last_success_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`
    create or replace function public.test_capture_dunnes_notification()
    returns trigger
    language plpgsql
    as $$
    declare
      event_type text;
      event_time timestamptz;
    begin
      if new.status = 'reserved'
         and new.reserved_by is not null
         and (old.status is distinct from 'reserved' or old.reserved_by is distinct from new.reserved_by) then
        event_type := 'voucher_reserved';
        event_time := coalesce(new.reserved_at, now());
      elsif old.status = 'reserved'
         and old.reserved_by is not null
         and new.status = 'available'
         and new.reserved_by is null
         and old.reserved_at is not null
         and old.reserved_at > now() - interval '30 minutes' then
        event_type := 'reservation_cancelled';
        event_time := now();
      elsif new.status = 'used' and old.status is distinct from 'used' then
        event_type := 'voucher_used';
        event_time := coalesce(new.used_at, now());
      else
        return new;
      end if;

      insert into app_notifications (profile_id, voucher_id, notification_type, dedupe_key)
      values (new.owner_id, new.id, event_type, event_type || ':' || new.id::text || ':' || extract(epoch from event_time)::text)
      on conflict (dedupe_key) do nothing;
      return new;
    end
    $$
  `;
  await sql`drop trigger if exists test_dunnes_voucher_notification_events on dunnes_vouchers`;
  await sql`
    create trigger test_dunnes_voucher_notification_events
    after update of status, reserved_by, reserved_at, used_at on dunnes_vouchers
    for each row execute function public.test_capture_dunnes_notification()
  `;
}

test("owner receives reservation, cancellation, expiry-day and used notifications", async ({ browser }) => {
  test.setTimeout(60000);
  expect(SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
  expect(DATABASE_URL.length).toBeGreaterThan(0);

  const sql = postgres(DATABASE_URL, { max: 1 });
  try {
    await prepareNotificationSchema(sql);
    await sql`delete from dunnes_vouchers where id in (${FLOW_VOUCHER_ID}::uuid, ${TODAY_VOUCHER_ID}::uuid, ${FUTURE_VOUCHER_ID}::uuid)`;
    await sql`delete from profiles where id in (${OWNER.profileId}::uuid, ${RESERVER.profileId}::uuid)`;
    await sql`
      insert into profiles (id, device_key, auth_user_id, updated_at)
      values
        (${OWNER.profileId}::uuid, ${OWNER.deviceKey}::uuid, ${OWNER.authUserId}::uuid, now()),
        (${RESERVER.profileId}::uuid, ${RESERVER.deviceKey}::uuid, ${RESERVER.authUserId}::uuid, now())
    `;
    await sql`
      insert into dunnes_vouchers (
        id, owner_id, voucher_type, barcode, image_data, membership_required, expires_on, status, review_status
      ) values
        (${FLOW_VOUCHER_ID}::uuid, ${OWNER.profileId}::uuid, '10off40', '2717777777001', 'data:image/png;base64,QQ==', false, (now() at time zone 'Europe/Dublin')::date + 1, 'available', 'approved'),
        (${TODAY_VOUCHER_ID}::uuid, ${OWNER.profileId}::uuid, '5off25', '2717777777002', 'data:image/png;base64,Qg==', false, (now() at time zone 'Europe/Dublin')::date, 'available', 'approved'),
        (${FUTURE_VOUCHER_ID}::uuid, ${OWNER.profileId}::uuid, '10off50', '2717777777003', 'data:image/png;base64,Qw==', false, (now() at time zone 'Europe/Dublin')::date + 1, 'available', 'approved')
    `;

    await sql`
      update dunnes_vouchers
      set status = 'reserved', reserved_by = ${RESERVER.profileId}::uuid, reserved_at = now(), updated_at = now()
      where id = ${FLOW_VOUCHER_ID}::uuid
    `;
    await sql`
      update dunnes_vouchers
      set status = 'available', reserved_by = null, reserved_at = null, updated_at = now()
      where id = ${FLOW_VOUCHER_ID}::uuid
    `;
    await sql`
      update dunnes_vouchers
      set status = 'reserved', reserved_by = ${RESERVER.profileId}::uuid, reserved_at = now(), updated_at = now()
      where id = ${FLOW_VOUCHER_ID}::uuid
    `;
    await sql`
      update dunnes_vouchers
      set status = 'used', used_at = now(), updated_at = now()
      where id = ${FLOW_VOUCHER_ID}::uuid
    `;

    await sql`
      insert into app_notifications (profile_id, voucher_id, notification_type, dedupe_key)
      select
        v.owner_id,
        v.id,
        'voucher_expiring_today',
        'voucher_expiring_today:' || v.id::text || ':' || v.expires_on::text
      from dunnes_vouchers v
      where v.expires_on = (now() at time zone 'Europe/Dublin')::date
        and v.status in ('available', 'reserved')
        and v.review_status = 'approved'
      on conflict (dedupe_key) do nothing
    `;
  } finally {
    await sql.end();
  }

  const owner = await signedInContext(browser, OWNER);
  try {
    const response = await owner.request.get(`${BASE_URL}/api/notifications`);
    expect(response.status()).toBe(200);
    const payload = await response.json();
    expect(payload.unreadCount).toBe(5);

    const flowTypes = payload.notifications
      .filter((item) => item.voucher_id === FLOW_VOUCHER_ID)
      .map((item) => item.notification_type);
    expect(flowTypes.filter((type) => type === "voucher_reserved")).toHaveLength(2);
    expect(flowTypes).toContain("reservation_cancelled");
    expect(flowTypes).toContain("voucher_used");
    expect(payload.notifications.some((item) => item.voucher_id === TODAY_VOUCHER_ID && item.notification_type === "voucher_expiring_today")).toBe(true);
    expect(payload.notifications.some((item) => item.voucher_id === FUTURE_VOUCHER_ID && item.notification_type === "voucher_expiring_today")).toBe(false);

    const readResponse = await owner.request.post(`${BASE_URL}/api/notifications`, {
      headers: { origin: BASE_URL, "content-type": "application/json" },
      data: { action: "mark_all_read" },
    });
    expect(readResponse.status()).toBe(200);
    const afterRead = await owner.request.get(`${BASE_URL}/api/notifications`);
    expect((await afterRead.json()).unreadCount).toBe(0);

    const pushResponse = await owner.request.get(`${BASE_URL}/api/push-subscriptions`);
    expect(pushResponse.status()).toBe(200);
    const pushState = await pushResponse.json();
    expect(pushState.subscribed).toBe(false);
    expect(pushState.publicKey).toMatch(/^[A-Za-z0-9_-]{80,100}$/);

    const workerResponse = await owner.request.get(`${BASE_URL}/push-sw.js`);
    expect(workerResponse.status()).toBe(200);
    expect(await workerResponse.text()).toContain("showNotification");

    const page = await owner.newPage();
    await page.goto(`${BASE_URL}/dunnes`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "알림" })).toBeVisible({ timeout: 10000 });
  } finally {
    await owner.close();
    const cleanup = postgres(DATABASE_URL, { max: 1 });
    try {
      await cleanup`drop trigger if exists test_dunnes_voucher_notification_events on dunnes_vouchers`;
      await cleanup`drop function if exists public.test_capture_dunnes_notification()`;
      await cleanup`delete from dunnes_vouchers where id in (${FLOW_VOUCHER_ID}::uuid, ${TODAY_VOUCHER_ID}::uuid, ${FUTURE_VOUCHER_ID}::uuid)`;
      await cleanup`delete from profiles where id in (${OWNER.profileId}::uuid, ${RESERVER.profileId}::uuid)`;
    } finally {
      await cleanup.end();
    }
  }
});

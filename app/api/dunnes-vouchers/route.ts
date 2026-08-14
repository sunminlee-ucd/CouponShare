import { getSqlClient } from "@/db";
import { consumeRateLimit } from "@/app/api/rate-limit";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const barcodePattern = /^\d{10,16}$/;
const imagePattern = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMAGE_LENGTH = 900_000;
const globalForDunnes = globalThis as typeof globalThis & { couponShareDunnesSchema?: Promise<void> };

type VoucherType = "5off25" | "10off40" | "10off50";

class DailyReservationLimitError extends Error {}
class VoucherUnavailableError extends Error {}

function validDeviceKey(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

async function createSchema() {
  const sql = getSqlClient();
  await sql`
    create table if not exists dunnes_vouchers (
      id uuid primary key default gen_random_uuid(),
      owner_id uuid not null references profiles(id) on delete cascade,
      voucher_type text not null check (voucher_type in ('5off25', '10off40', '10off50')),
      barcode text not null unique,
      image_data text not null,
      membership_required boolean not null default false,
      membership_image_data text,
      expires_on date not null,
      status text not null default 'available'
        check (status in ('available', 'reserved', 'used', 'expired', 'rejected')),
      review_status text not null default 'pending'
        check (review_status in ('pending', 'approved', 'rejected')),
      reserved_by uuid references profiles(id) on delete set null,
      reserved_at timestamptz,
      used_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists dunnes_vouchers_status_expiry_idx on dunnes_vouchers(status, expires_on)`;
  await sql`create index if not exists dunnes_vouchers_owner_idx on dunnes_vouchers(owner_id, created_at desc)`;
  await sql`create index if not exists dunnes_vouchers_reserved_by_idx on dunnes_vouchers(reserved_by, reserved_at desc)`;
  await sql`alter table dunnes_vouchers add column if not exists membership_required boolean not null default false`;
  await sql`alter table dunnes_vouchers add column if not exists membership_image_data text`;
  await sql`alter table dunnes_vouchers add column if not exists review_status text not null default 'approved'`;
  await sql`alter table dunnes_vouchers alter column review_status set default 'pending'`;
  const [voucherTypeConstraint] = await sql<{ definition: string }[]>`
    select pg_get_constraintdef(oid) as definition
    from pg_constraint
    where conrelid = 'dunnes_vouchers'::regclass
      and conname = 'dunnes_vouchers_voucher_type_check'
  `;
  if (!voucherTypeConstraint?.definition.includes("10off50")) {
    await sql`alter table dunnes_vouchers drop constraint if exists dunnes_vouchers_voucher_type_check`;
    await sql`
      alter table dunnes_vouchers
      add constraint dunnes_vouchers_voucher_type_check
      check (voucher_type in ('5off25', '10off40', '10off50'))
    `;
  }
  await sql`alter table dunnes_vouchers enable row level security`;
  await sql`
    create table if not exists dunnes_daily_reservations (
      profile_id uuid not null references profiles(id) on delete cascade,
      usage_date date not null,
      reservation_count smallint not null default 0 check (reservation_count between 0 and 3),
      updated_at timestamptz not null default now(),
      primary key (profile_id, usage_date)
    )
  `;
  await sql`alter table dunnes_daily_reservations enable row level security`;
}

function ensureSchema() {
  globalForDunnes.couponShareDunnesSchema ??= createSchema();
  return globalForDunnes.couponShareDunnesSchema;
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

async function findOrCreateProfile(deviceKey: string) {
  const sql = getSqlClient();
  const [profile] = await sql<{ id: string; is_blocked: boolean }[]>`
    insert into profiles (device_key, updated_at)
    values (${deviceKey}::uuid, now())
    on conflict (device_key) do update set updated_at = now()
    returning id::text, is_blocked
  `;
  return profile;
}

async function tidyVouchers() {
  const sql = getSqlClient();
  await sql`
    delete from dunnes_vouchers
    where expires_on < (now() at time zone 'Europe/Dublin')::date
  `;
  await sql`
    update dunnes_vouchers
    set status = 'available', reserved_by = null, reserved_at = null, updated_at = now()
    where status = 'reserved'
      and reserved_at < now() - interval '30 minutes'
  `;
}

async function voucherState(profileId: string) {
  const sql = getSqlClient();
  const [rows, usageRows] = await Promise.all([sql<Array<{
    id: string;
    voucher_type: VoucherType;
    barcode_masked: string;
    image_data: string | null;
    membership_required: boolean;
    membership_image_data: string | null;
    expires_on: string;
    status: "available" | "reserved" | "used" | "expired" | "rejected";
    review_status: "pending" | "approved" | "rejected";
    is_mine: boolean;
    reserved_by_me: boolean;
    reserved_until: string | null;
  }>>`
    select
      v.id::text,
      v.voucher_type,
      '•••• ' || right(v.barcode, 4) as barcode_masked,
      case
        when v.owner_id = ${profileId}::uuid or v.reserved_by = ${profileId}::uuid then v.image_data
        else null
      end as image_data,
      v.membership_required,
      case
        when v.membership_required and (v.owner_id = ${profileId}::uuid or v.reserved_by = ${profileId}::uuid) then v.membership_image_data
        else null
      end as membership_image_data,
      v.expires_on::text,
      v.status,
      v.review_status,
      v.owner_id = ${profileId}::uuid as is_mine,
      v.reserved_by = ${profileId}::uuid as reserved_by_me,
      case when v.reserved_at is not null then (v.reserved_at + interval '30 minutes')::text else null end as reserved_until
    from dunnes_vouchers v
    join profiles owner on owner.id = v.owner_id and owner.is_blocked = false
    where
      (v.status in ('available', 'reserved') and v.review_status = 'approved' and v.owner_id <> ${profileId}::uuid)
      or v.owner_id = ${profileId}::uuid
    order by v.expires_on, v.created_at
  `, sql<{ reservation_count: number }[]>`
    select reservation_count
    from dunnes_daily_reservations
    where profile_id = ${profileId}::uuid
      and usage_date = (now() at time zone 'Europe/Dublin')::date
  `]);
  return { vouchers: rows, reservationsRemaining: Math.max(0, 3 - Number(usageRows[0]?.reservation_count ?? 0)) };
}

export async function GET(request: Request) {
  const deviceKey = new URL(request.url).searchParams.get("deviceKey");
  if (!validDeviceKey(deviceKey)) return Response.json({ error: "invalid_device" }, { status: 400 });
  try {
    await ensureSchema();
    const profile = await findOrCreateProfile(deviceKey);
    if (profile.is_blocked) return Response.json({ error: "blocked" }, { status: 403 });
    await tidyVouchers();
    return Response.json(await voucherState(profile.id), { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    console.error("Dunnes voucher read failed", error);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  if (!validDeviceKey(body.deviceKey)) return Response.json({ error: "invalid_device" }, { status: 400 });

  try {
    await ensureSchema();
    const sql = getSqlClient();
    const profile = await findOrCreateProfile(body.deviceKey);
    if (profile.is_blocked) return Response.json({ error: "blocked" }, { status: 403 });
    await tidyVouchers();

    const action = typeof body.action === "string" ? body.action : "";
    const rateRule = action === "upload" ? { limit: 2, minutes: 1440 } : { limit: 60, minutes: 60 };
    if (await consumeRateLimit(profile.id, `dunnes:${action || "invalid"}`, rateRule.limit, rateRule.minutes) === null) {
      return Response.json({ error: "rate_limit" }, { status: 429, headers: { "retry-after": String(rateRule.minutes * 60) } });
    }

    if (body.action === "upload") {
      const voucherType = body.voucherType;
      const barcode = typeof body.barcode === "string" ? body.barcode.replace(/\D/g, "") : "";
      const imageData = body.imageData;
      const membershipRequired = body.membershipRequired === true;
      const membershipImageData = body.membershipImageData;
      const expiresOn = body.expiresOn;
      if ((voucherType !== "5off25" && voucherType !== "10off40" && voucherType !== "10off50")
        || !barcodePattern.test(barcode)
        || typeof imageData !== "string" || imageData.length > MAX_IMAGE_LENGTH || !imagePattern.test(imageData)
        || (membershipRequired && (typeof membershipImageData !== "string" || membershipImageData.length > MAX_IMAGE_LENGTH || !imagePattern.test(membershipImageData)))
        || typeof expiresOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) {
        return Response.json({ error: "invalid_voucher" }, { status: 400 });
      }
      if (expiresOn < new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin" }).format(new Date())) {
        return Response.json({ error: "expired" }, { status: 400 });
      }
      const [ownedCount] = await sql<{ count: number }[]>`
        select count(*)::int as count from dunnes_vouchers
        where owner_id = ${profile.id}::uuid and status in ('available', 'reserved')
      `;
      if ((ownedCount?.count ?? 0) >= 5) return Response.json({ error: "voucher_limit" }, { status: 429 });
      try {
        await sql`
          insert into dunnes_vouchers (owner_id, voucher_type, barcode, image_data, membership_required, membership_image_data, expires_on)
          values (${profile.id}::uuid, ${voucherType}, ${barcode}, ${imageData}, ${membershipRequired}, ${membershipRequired ? membershipImageData as string : null}, ${expiresOn}::date)
        `;
      } catch (error) {
        if ((error as { code?: string }).code === "23505") return Response.json({ error: "duplicate" }, { status: 409 });
        throw error;
      }
    } else if (body.action === "reserve" && typeof body.voucherId === "string" && uuidPattern.test(body.voucherId)) {
      try {
        await sql.begin(async (transaction) => {
          const [usage] = await transaction<{ reservation_count: number }[]>`
            insert into dunnes_daily_reservations (profile_id, usage_date, reservation_count, updated_at)
            values (${profile.id}::uuid, (now() at time zone 'Europe/Dublin')::date, 1, now())
            on conflict (profile_id, usage_date) do update
              set reservation_count = dunnes_daily_reservations.reservation_count + 1,
                  updated_at = now()
              where dunnes_daily_reservations.reservation_count < 3
            returning reservation_count
          `;
          if (!usage) throw new DailyReservationLimitError();
          const [reserved] = await transaction`
            update dunnes_vouchers
            set status = 'reserved', reserved_by = ${profile.id}::uuid, reserved_at = now(), updated_at = now()
            where id = ${body.voucherId}::uuid
              and status = 'available'
              and review_status = 'approved'
              and owner_id <> ${profile.id}::uuid
              and expires_on >= (now() at time zone 'Europe/Dublin')::date
            returning id
          `;
          if (!reserved) throw new VoucherUnavailableError();
        });
      } catch (error) {
        if (error instanceof DailyReservationLimitError) {
          return Response.json({ error: "daily_reservation_limit" }, { status: 429 });
        }
        if (error instanceof VoucherUnavailableError) {
          return Response.json({ error: "already_reserved" }, { status: 409 });
        }
        throw error;
      }
    } else if (body.action === "cancel_reservation" && typeof body.voucherId === "string" && uuidPattern.test(body.voucherId)) {
      await sql`
        update dunnes_vouchers
        set status = 'available', reserved_by = null, reserved_at = null, updated_at = now()
        where id = ${body.voucherId}::uuid and reserved_by = ${profile.id}::uuid and status = 'reserved'
      `;
    } else if (body.action === "mark_used" && typeof body.voucherId === "string" && uuidPattern.test(body.voucherId)) {
      await sql`
        update dunnes_vouchers
        set status = 'used', used_at = now(), updated_at = now()
        where id = ${body.voucherId}::uuid and reserved_by = ${profile.id}::uuid and status = 'reserved'
      `;
    } else if (body.action === "delete" && typeof body.voucherId === "string" && uuidPattern.test(body.voucherId)) {
      await sql`delete from dunnes_vouchers where id = ${body.voucherId}::uuid and owner_id = ${profile.id}::uuid`;
    } else {
      return Response.json({ error: "invalid_action" }, { status: 400 });
    }
    return Response.json(await voucherState(profile.id), { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    console.error("Dunnes voucher update failed", error);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}

import { getSqlClient } from "@/db";
import { consumeRateLimit } from "@/app/api/rate-limit";
import { readCookie, USER_AUTH_COOKIE_NAME, verifyUserAuthToken } from "@/app/auth/session";
import { reviewDunnesUploadImages, type VoucherType } from "@/app/dunnes/auto-review";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const barcodePattern = /^\d{10,16}$/;
const imagePattern = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMAGE_LENGTH = 900_000;

type ProfileRow = { id: string; is_blocked: boolean };

class DailyReservationLimitError extends Error {}
class VoucherUnavailableError extends Error {}

function validDeviceKey(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
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
  const [profile] = await sql<ProfileRow[]>`
    insert into profiles (device_key, updated_at)
    values (${deviceKey}::uuid, now())
    on conflict (device_key) do update set updated_at = now()
    returning id::text, is_blocked
  `;
  return profile;
}

async function authenticatedProfile(request: Request) {
  const token = readCookie(request.headers.get("cookie"), USER_AUTH_COOKIE_NAME);
  const session = await verifyUserAuthToken(token);
  if (!session) return null;
  const sql = getSqlClient();
  const [profile] = await sql<ProfileRow[]>`
    select id::text, is_blocked
    from profiles
    where id = ${session.profileId}::uuid
      and auth_user_id = ${session.authUserId}::uuid
    limit 1
  `;
  return profile ?? null;
}

async function tidyVouchers() {
  const sql = getSqlClient();
  await sql`
    update dunnes_vouchers
    set status = 'expired', reserved_by = null, reserved_at = null, updated_at = now()
    where expires_on < (now() at time zone 'Europe/Dublin')::date
      and status in ('available', 'reserved')
  `;
  await sql`
    update dunnes_vouchers
    set status = 'available', reserved_by = null, reserved_at = null, updated_at = now()
    where status = 'reserved'
      and reserved_at < now() - interval '30 minutes'
      and expires_on >= (now() at time zone 'Europe/Dublin')::date
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
  const signedInProfile = await authenticatedProfile(request);
  const deviceKey = new URL(request.url).searchParams.get("deviceKey");
  if (!signedInProfile && !validDeviceKey(deviceKey)) return Response.json({ error: "invalid_device" }, { status: 400 });
  try {
    const profile = signedInProfile ?? await findOrCreateProfile(deviceKey as string);
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
  const profile = await authenticatedProfile(request);
  if (!profile) return Response.json({ error: "auth_required" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const sql = getSqlClient();
    if (profile.is_blocked) return Response.json({ error: "blocked" }, { status: 403 });
    await tidyVouchers();

    const action = typeof body.action === "string" ? body.action : "";
    const rateRule = action === "report" ? { limit: 6, minutes: 1440 } : action === "record_view" ? { limit: 30, minutes: 60 } : { limit: 60, minutes: 60 };
    if (action !== "upload" && await consumeRateLimit(profile.id, `dunnes:${action || "invalid"}`, rateRule.limit, rateRule.minutes) === null) {
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
        || typeof imageData !== "string" || !imagePattern.test(imageData)
        || typeof expiresOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) {
        return Response.json({ error: "invalid_voucher" }, { status: 400 });
      }
      if (imageData.length > MAX_IMAGE_LENGTH) return Response.json({ error: "image_too_large" }, { status: 413 });
      if (membershipRequired && typeof membershipImageData !== "string") {
        return Response.json({ error: "membership_image_required" }, { status: 400 });
      }
      if (membershipRequired && !imagePattern.test(membershipImageData as string)) {
        return Response.json({ error: "invalid_voucher" }, { status: 400 });
      }
      if (membershipRequired && (membershipImageData as string).length > MAX_IMAGE_LENGTH) {
        return Response.json({ error: "membership_image_too_large" }, { status: 413 });
      }
      if (expiresOn < new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin" }).format(new Date())) {
        return Response.json({ error: "expired" }, { status: 400 });
      }
      const [existing] = await sql`
        select id
        from dunnes_vouchers
        where barcode = ${barcode}
           or md5(image_data) = md5(${imageData})
        limit 1
      `;
      if (existing) return Response.json({ error: "duplicate" }, { status: 409 });
      const [ownedCount] = await sql<{ count: number }[]>`
        select count(*)::int as count from dunnes_vouchers
        where owner_id = ${profile.id}::uuid and status in ('available', 'reserved')
      `;
      if ((ownedCount?.count ?? 0) >= 5) return Response.json({ error: "voucher_limit" }, { status: 429 });
      if (await consumeRateLimit(profile.id, "dunnes:upload", 2, 1440) === null) {
        return Response.json({ error: "rate_limit" }, { status: 429, headers: { "retry-after": "86400" } });
      }

      const review = await reviewDunnesUploadImages({
        voucherType,
        barcode,
        expiresOn,
        imageData,
        membershipRequired,
        membershipImageData: membershipRequired ? membershipImageData as string : null,
      });
      const reviewStatus = review.autoApprove ? "approved" : "pending";
      if (!review.autoApprove) {
        console.info("Dunnes upload queued for manual review", { profileId: profile.id, reasons: review.reasons });
      }

      try {
        await sql`
          insert into dunnes_vouchers (owner_id, voucher_type, barcode, image_data, membership_required, membership_image_data, expires_on, review_status)
          values (${profile.id}::uuid, ${voucherType}, ${barcode}, ${imageData}, ${membershipRequired}, ${membershipRequired ? membershipImageData as string : null}, ${expiresOn}::date, ${reviewStatus})
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
    } else if (body.action === "record_view" && typeof body.voucherId === "string" && uuidPattern.test(body.voucherId)) {
      const [viewable] = await sql`
        select id from dunnes_vouchers
        where id = ${body.voucherId}::uuid
          and reserved_by = ${profile.id}::uuid
          and status = 'reserved'
      `;
      if (!viewable) return Response.json({ error: "view_unavailable" }, { status: 409 });
      await sql`
        insert into dunnes_voucher_activity (voucher_id, profile_id, event_type)
        values (${body.voucherId}::uuid, ${profile.id}::uuid, 'viewed')
      `;
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
    } else if (body.action === "report" && typeof body.voucherId === "string" && uuidPattern.test(body.voucherId)
      && (body.reason === "invalid_voucher" || body.reason === "membership_not_scanned")) {
      const [reported] = await sql`
        insert into dunnes_voucher_reports (voucher_id, reporter_id, reason)
        select id, ${profile.id}::uuid, ${body.reason}
        from dunnes_vouchers
        where id = ${body.voucherId}::uuid
          and reserved_by = ${profile.id}::uuid
          and owner_id <> ${profile.id}::uuid
        on conflict (voucher_id, reporter_id, reason) do nothing
        returning voucher_id
      `;
      if (!reported) return Response.json({ error: "report_unavailable" }, { status: 409 });
      const [reportCount] = await sql<{ count: number }[]>`
        select count(distinct reporter_id)::int as count
        from dunnes_voucher_reports
        where voucher_id = ${body.voucherId}::uuid and status = 'open'
      `;
      if ((reportCount?.count ?? 0) >= 2) {
        await sql`
          update dunnes_vouchers
          set review_status = 'pending', updated_at = now()
          where id = ${body.voucherId}::uuid
        `;
      }
    } else if (body.action === "delete" && typeof body.voucherId === "string" && uuidPattern.test(body.voucherId)) {
      await sql`
        update dunnes_vouchers
        set status = 'rejected', review_status = 'rejected', reserved_by = null, reserved_at = null, updated_at = now()
        where id = ${body.voucherId}::uuid and owner_id = ${profile.id}::uuid
      `;
    } else {
      return Response.json({ error: "invalid_action" }, { status: 400 });
    }
    return Response.json(await voucherState(profile.id), { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    console.error("Dunnes voucher update failed", error);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}

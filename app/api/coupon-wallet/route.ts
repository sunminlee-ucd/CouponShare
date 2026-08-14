import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { createHash } from "node:crypto";
import { getDb, getSqlClient } from "@/db";
import { couponUseEvents, coupons, profiles } from "@/db/schema";
import { isCouponExpired } from "@/app/coupon-expiry";
import { consumeRateLimit } from "@/app/api/rate-limit";

export const runtime = "nodejs";

const ALPHA_GROUP_CODE = "couponshare-alpha-v1";
const MAX_QR_DATA_LENGTH = 1_200_000;

type WalletCoupon = {
  externalKey: string;
  productId: string;
  productName?: string | null;
  label: string;
  discountType: "fixed" | "percent";
  amount: number;
  expiresText: string;
  maxUnits?: number | null;
  keywords?: string[];
  sourceCapturedAt?: string | null;
};

type SharedCouponRow = {
  owner_id: string;
  external_key: string | null;
  product_id: string | null;
  product_name: string | null;
  label: string | null;
  discount_type: "fixed" | "percent" | null;
  amount: string | null;
  expires_text: string | null;
  max_units: number | null;
  keywords: string[] | null;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const qrDataPattern = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const qrFingerprintPattern = /^[a-f0-9]{64}$/;

function validDeviceKey(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

function validCoupon(value: unknown): value is WalletCoupon {
  if (!value || typeof value !== "object") return false;
  const coupon = value as Partial<WalletCoupon>;
  return typeof coupon.externalKey === "string"
    && coupon.externalKey.length <= 500
    && typeof coupon.productId === "string" && coupon.productId.length <= 300
    && (coupon.productName === undefined || coupon.productName === null || (typeof coupon.productName === "string" && coupon.productName.length <= 300))
    && typeof coupon.label === "string" && coupon.label.length <= 160
    && (coupon.discountType === "fixed" || coupon.discountType === "percent")
    && typeof coupon.amount === "number"
    && Number.isFinite(coupon.amount)
    && coupon.amount >= 0 && coupon.amount <= 1000
    && typeof coupon.expiresText === "string" && coupon.expiresText.length <= 160
    && (coupon.maxUnits === undefined || coupon.maxUnits === null || (Number.isFinite(coupon.maxUnits) && coupon.maxUnits >= 1 && coupon.maxUnits <= 99))
    && (coupon.keywords === undefined || (Array.isArray(coupon.keywords) && coupon.keywords.length <= 20 && coupon.keywords.every((keyword) => typeof keyword === "string" && keyword.length <= 80)));
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
  const db = getDb();
  const [profile] = await db.insert(profiles)
    .values({ deviceKey })
    .onConflictDoUpdate({
      target: profiles.deviceKey,
      set: { updatedAt: new Date() },
    })
    .returning({ id: profiles.id, isBlocked: profiles.isBlocked });
  return profile;
}

async function usedKeys(ownerId: string) {
  const db = getDb();
  const rows = await db.select({ externalKey: coupons.externalKey })
    .from(coupons)
    .where(and(eq(coupons.ownerId, ownerId), isNotNull(coupons.usedAt)));
  return rows.map((row) => row.externalKey);
}

async function ensureAlphaGroup(profileId: string) {
  const sql = getSqlClient();
  await sql`
    insert into groups (invite_code, created_by)
    values (${ALPHA_GROUP_CODE}, ${profileId}::uuid)
    on conflict (invite_code) do nothing
  `;
  const [group] = await sql<{ id: string }[]>`
    select id::text from groups where invite_code = ${ALPHA_GROUP_CODE} limit 1
  `;
  await sql`
    insert into group_members (group_id, profile_id)
    values (${group.id}::uuid, ${profileId}::uuid)
    on conflict do nothing
  `;
}

async function permittedCouponOwner(profileId: string, requestedOwnerId: unknown) {
  if (requestedOwnerId === undefined || requestedOwnerId === null || requestedOwnerId === profileId) return profileId;
  if (typeof requestedOwnerId !== "string" || !uuidPattern.test(requestedOwnerId)) return null;
  const sql = getSqlClient();
  const [owner] = await sql<{ id: string }[]>`
    select owner.id::text
    from group_members requester
    join groups g on g.id = requester.group_id and g.invite_code = ${ALPHA_GROUP_CODE}
    join group_members member on member.group_id = g.id
    join profiles owner on owner.id = member.profile_id and owner.is_blocked = false
    join lidl_cards card on card.owner_id = owner.id and card.is_shared = true and card.review_status <> 'rejected'
    where requester.profile_id = ${profileId}::uuid
      and owner.id = ${requestedOwnerId}::uuid
    limit 1
  `;
  return owner?.id ?? null;
}

async function deleteExpiredGroupCoupons(profileId: string) {
  const sql = getSqlClient();
  const rows = await sql<Array<{ id: string; expires_text: string; source_captured_at: string | null }>>`
    select distinct c.id::text, c.expires_text, c.source_captured_at::text
    from group_members requester
    join group_members member on member.group_id = requester.group_id
    join coupons c on c.owner_id = member.profile_id
    where requester.profile_id = ${profileId}::uuid
      and c.used_at is null
  `;
  const expiredIds = rows
    .filter((coupon) => isCouponExpired(coupon.expires_text, coupon.source_captured_at))
    .map((coupon) => coupon.id);
  if (expiredIds.length) await getDb().delete(coupons).where(inArray(coupons.id, expiredIds));
}

async function walletState(profileId: string) {
  await deleteExpiredGroupCoupons(profileId);
  const sql = getSqlClient();
  const rows = await sql<SharedCouponRow[]>`
    select
      owner.id::text as owner_id,
      c.external_key,
      c.product_id,
      c.product_name,
      c.label,
      c.discount_type,
      c.amount::text,
      c.expires_text,
      c.max_units,
      c.keywords
    from group_members requester
    join groups g on g.id = requester.group_id and g.invite_code = ${ALPHA_GROUP_CODE}
    join group_members shared_member on shared_member.group_id = g.id
    join profiles owner on owner.id = shared_member.profile_id and owner.is_blocked = false
    join lidl_cards card on card.owner_id = owner.id and card.is_shared = true and card.review_status <> 'rejected'
    left join coupons c on c.owner_id = owner.id and c.is_active = true and c.used_at is null
    where requester.profile_id = ${profileId}::uuid
    order by owner.created_at, c.created_at
  `;

  const members = new Map<string, {
    id: string;
    isCurrentUser: boolean;
    qrAvailable: boolean;
    coupons: Array<{
      externalKey: string;
      productId: string;
      productName: string | null;
      label: string;
      type: "fixed" | "percent";
      amount: number;
      expires: string;
      maxUnits: number;
      keywords: string[];
    }>;
  }>();

  for (const row of rows) {
    if (!members.has(row.owner_id)) {
      members.set(row.owner_id, {
        id: row.owner_id,
        isCurrentUser: row.owner_id === profileId,
        qrAvailable: true,
        coupons: [],
      });
    }
    if (row.external_key && row.product_id && row.label && row.discount_type && row.amount && row.expires_text) {
      members.get(row.owner_id)?.coupons.push({
        externalKey: row.external_key,
        productId: row.product_id,
        productName: row.product_name,
        label: row.label,
        type: row.discount_type,
        amount: Number(row.amount),
        expires: row.expires_text,
        maxUnits: row.max_units ?? 1,
        keywords: Array.isArray(row.keywords) ? row.keywords : [],
      });
    }
  }

  const [dailyUsage] = await sql<{ view_count: number }[]>`
    select view_count
    from qr_daily_usage
    where profile_id = ${profileId}::uuid
      and usage_date = (now() at time zone 'Europe/Dublin')::date
    limit 1
  `;
  const [savingTotals] = await sql<{ month_mine: string; total_mine: string; community_total: string }[]>`
    with savings_events as (
      select used_by, used_at, saved_amount, reverted_at
      from coupon_use_events
      union all
      select
        reserved_by as used_by,
        used_at,
        case when voucher_type = '5off25' then 5::numeric else 10::numeric end as saved_amount,
        null::timestamptz as reverted_at
      from dunnes_vouchers
      where status = 'used'
        and reserved_by is not null
        and used_at is not null
    )
    select
      coalesce(sum(saved_amount) filter (
        where used_by = ${profileId}::uuid
          and reverted_at is null
          and used_at >= (date_trunc('month', now() at time zone 'Europe/Dublin') at time zone 'Europe/Dublin')
      ), 0)::text as month_mine,
      coalesce(sum(saved_amount) filter (
        where used_by = ${profileId}::uuid and reverted_at is null
      ), 0)::text as total_mine,
      coalesce(sum(saved_amount) filter (where reverted_at is null), 0)::text as community_total
    from savings_events
  `;
  return {
    currentProfileId: profileId,
    usedKeys: await usedKeys(profileId),
    members: [...members.values()],
    qrViewsRemaining: Math.max(0, 3 - (dailyUsage?.view_count ?? 0)),
    savings: {
      monthMine: Number(savingTotals?.month_mine ?? 0),
      totalMine: Number(savingTotals?.total_mine ?? 0),
      communityTotal: Number(savingTotals?.community_total ?? 0),
    },
  };
}

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL) {
    return Response.json({ error: "database_not_configured" }, { status: 503 });
  }
  const deviceKey = new URL(request.url).searchParams.get("deviceKey");
  if (!validDeviceKey(deviceKey)) {
    return Response.json({ error: "invalid_device_key" }, { status: 400 });
  }

  try {
    const db = getDb();
    const [profile] = await db.select({ id: profiles.id, isBlocked: profiles.isBlocked })
      .from(profiles)
      .where(eq(profiles.deviceKey, deviceKey))
      .limit(1);
    if (!profile) return Response.json({ usedKeys: [], members: [] });
    if (profile.isBlocked) return Response.json({ error: "profile_blocked" }, { status: 403 });
    return Response.json(await walletState(profile.id));
  } catch (error) {
    console.error("Coupon wallet read failed", error);
    return Response.json({ error: "database_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!process.env.DATABASE_URL) {
    return Response.json({ error: "database_not_configured" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!validDeviceKey(body.deviceKey)) {
    return Response.json({ error: "invalid_device_key" }, { status: 400 });
  }

  try {
    const db = getDb();
    const action = typeof body.action === "string" ? body.action : "";
    if (!["sync", "set_sharing", "mark_used", "undo_used"].includes(action)) {
      return Response.json({ error: "unsupported_action" }, { status: 400 });
    }
    const profile = await findOrCreateProfile(body.deviceKey);
    if (profile.isBlocked) return Response.json({ error: "profile_blocked" }, { status: 403 });

    const rateRule = action === "sync" ? { limit: 12, minutes: 60 }
      : action === "set_sharing" && body.sharing === true ? { limit: 5, minutes: 1440 }
        : action === "mark_used" || action === "undo_used" ? { limit: 30, minutes: 60 }
          : null;
    if (rateRule && await consumeRateLimit(profile.id, `wallet:${action}`, rateRule.limit, rateRule.minutes) === null) {
      return Response.json({ error: "rate_limit" }, { status: 429, headers: { "retry-after": String(rateRule.minutes * 60) } });
    }

    if (body.action === "sync") {
      if (!Array.isArray(body.coupons) || body.coupons.length > 200 || !body.coupons.every(validCoupon)) {
        return Response.json({ error: "invalid_coupons" }, { status: 400 });
      }

      const incomingCoupons = (body.coupons as WalletCoupon[])
        .filter((coupon) => !isCouponExpired(coupon.expiresText, coupon.sourceCapturedAt));

      await db.transaction(async (tx) => {
        await tx.update(coupons)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(coupons.ownerId, profile.id));

        for (const coupon of incomingCoupons) {
          await tx.insert(coupons).values({
            ownerId: profile.id,
            externalKey: coupon.externalKey,
            productId: coupon.productId,
            productName: coupon.productName ?? null,
            label: coupon.label,
            discountType: coupon.discountType,
            amount: String(coupon.amount),
            expiresText: coupon.expiresText,
            maxUnits: Math.max(1, Math.floor(coupon.maxUnits ?? 1)),
            keywords: coupon.keywords ?? [],
            isActive: true,
            sourceCapturedAt: coupon.sourceCapturedAt ? new Date(coupon.sourceCapturedAt) : null,
          }).onConflictDoUpdate({
            target: [coupons.ownerId, coupons.externalKey],
            set: {
              productId: coupon.productId,
              productName: coupon.productName ?? null,
              label: coupon.label,
              discountType: coupon.discountType,
              amount: String(coupon.amount),
              expiresText: coupon.expiresText,
              maxUnits: Math.max(1, Math.floor(coupon.maxUnits ?? 1)),
              keywords: coupon.keywords ?? [],
              isActive: true,
              sourceCapturedAt: coupon.sourceCapturedAt ? new Date(coupon.sourceCapturedAt) : null,
              updatedAt: new Date(),
            },
          });
        }
      });
      await ensureAlphaGroup(profile.id);
      return Response.json({ synced: incomingCoupons.length, ...(await walletState(profile.id)) });
    }

    if (body.action === "set_sharing" && typeof body.sharing === "boolean") {
      const qrData = body.qrData;
      const qrFingerprint = body.qrFingerprint;
      if (body.sharing && (typeof qrData !== "string"
        || qrData.length > MAX_QR_DATA_LENGTH
        || !qrDataPattern.test(qrData)
        || typeof qrFingerprint !== "string"
        || !qrFingerprintPattern.test(qrFingerprint))) {
        return Response.json({ error: "invalid_qr_image" }, { status: 400 });
      }
      await ensureAlphaGroup(profile.id);
      const sql = getSqlClient();
      const qrImageHash = body.sharing
        ? createHash("sha256").update(qrData as string).digest("hex")
        : null;
      if (body.sharing) {
        const [activeCoupon] = await sql<{ id: string }[]>`
          select id::text
          from coupons
          where owner_id = ${profile.id}::uuid
            and is_active = true
            and used_at is null
          limit 1
        `;
        if (!activeCoupon) {
          return Response.json({ error: "active_coupons_required" }, { status: 412 });
        }
        const [duplicate] = await sql<{ id: string }[]>`
          select id::text
          from lidl_cards
          where owner_id <> ${profile.id}::uuid
            and (qr_fingerprint = ${qrFingerprint as string} or qr_image_hash = ${qrImageHash})
          limit 1
        `;
        if (duplicate) {
          await sql`
            update profiles
            set
              risk_score = risk_score + 2,
              is_blocked = is_blocked or risk_score + 2 >= 10,
              updated_at = now()
            where id = ${profile.id}::uuid
          `;
          return Response.json({ error: "duplicate_qr" }, { status: 409 });
        }
      }
      await sql`
        insert into lidl_cards (owner_id, qr_object_path, qr_fingerprint, qr_image_hash, is_shared, updated_at)
        values (${profile.id}::uuid, ${body.sharing ? qrData as string : null}, ${body.sharing ? qrFingerprint as string : null}, ${qrImageHash}, ${body.sharing}, now())
        on conflict (owner_id) do update set
          qr_object_path = case when excluded.is_shared then excluded.qr_object_path else lidl_cards.qr_object_path end,
          qr_fingerprint = case when excluded.is_shared then excluded.qr_fingerprint else lidl_cards.qr_fingerprint end,
          qr_image_hash = case when excluded.is_shared then excluded.qr_image_hash else lidl_cards.qr_image_hash end,
          is_shared = excluded.is_shared,
          review_status = case when excluded.is_shared then 'pending' else lidl_cards.review_status end,
          review_note = null,
          updated_at = now()
      `;
      return Response.json(await walletState(profile.id));
    }

    if ((body.action === "mark_used" || body.action === "undo_used")
      && Array.isArray(body.externalKeys)
      && body.externalKeys.length <= 100
      && body.externalKeys.every((key) => typeof key === "string")) {
      const externalKeys = body.externalKeys as string[];
      if (!externalKeys.length) return Response.json({ updated: 0, usedKeys: await usedKeys(profile.id) });
      const ownerId = await permittedCouponOwner(profile.id, body.ownerId);
      if (!ownerId) return Response.json({ error: "coupon_owner_not_allowed" }, { status: 403 });

      if (body.action === "mark_used") {
        const savingValues = body.savingsByExternalKey && typeof body.savingsByExternalKey === "object"
          ? body.savingsByExternalKey as Record<string, unknown>
          : {};
        const now = new Date();
        const updated = await db.update(coupons)
          .set({ usedAt: now, updatedAt: now })
          .where(and(
            eq(coupons.ownerId, ownerId),
            eq(coupons.isActive, true),
            isNull(coupons.usedAt),
            inArray(coupons.externalKey, externalKeys),
          ))
          .returning({ id: coupons.id, externalKey: coupons.externalKey });
        if (updated.length) {
          await db.insert(couponUseEvents).values(updated.map((coupon) => ({
            couponId: coupon.id,
            usedBy: profile.id,
            usedAt: now,
            savedAmount: String(Math.max(0, Math.min(10_000, Number(savingValues[coupon.externalKey]) || 0))),
          })));
        }
        return Response.json({ updated: updated.length, ...(await walletState(profile.id)) });
      }

      const reversible = await db.select({ id: coupons.id })
        .from(couponUseEvents)
        .innerJoin(coupons, eq(couponUseEvents.couponId, coupons.id))
        .where(and(
          eq(couponUseEvents.usedBy, profile.id),
          isNull(couponUseEvents.revertedAt),
          eq(coupons.ownerId, ownerId),
          isNotNull(coupons.usedAt),
          inArray(coupons.externalKey, externalKeys),
        ));
      const reversibleIds = [...new Set(reversible.map((coupon) => coupon.id))];
      if (reversibleIds.length) {
        await db.update(coupons)
          .set({ usedAt: null, updatedAt: new Date() })
          .where(inArray(coupons.id, reversibleIds));
        await db.update(couponUseEvents)
          .set({ revertedAt: new Date() })
          .where(and(
            inArray(couponUseEvents.couponId, reversibleIds),
            eq(couponUseEvents.usedBy, profile.id),
            isNull(couponUseEvents.revertedAt),
          ));
      }
      return Response.json({ updated: reversibleIds.length, ...(await walletState(profile.id)) });
    }

    return Response.json({ error: "invalid_action" }, { status: 400 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return Response.json({ error: "duplicate_qr" }, { status: 409 });
    }
    console.error("Coupon wallet write failed", error);
    return Response.json({ error: "database_unavailable" }, { status: 503 });
  }
}

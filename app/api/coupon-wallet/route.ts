import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb, getSqlClient } from "@/db";
import { couponUseEvents, coupons, profiles } from "@/db/schema";

export const runtime = "nodejs";

const ALPHA_GROUP_CODE = "couponshare-alpha-v1";
const MAX_QR_DATA_LENGTH = 5_500_000;

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

function validDeviceKey(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

function validCoupon(value: unknown): value is WalletCoupon {
  if (!value || typeof value !== "object") return false;
  const coupon = value as Partial<WalletCoupon>;
  return typeof coupon.externalKey === "string"
    && coupon.externalKey.length <= 500
    && typeof coupon.productId === "string"
    && typeof coupon.label === "string"
    && (coupon.discountType === "fixed" || coupon.discountType === "percent")
    && typeof coupon.amount === "number"
    && Number.isFinite(coupon.amount)
    && coupon.amount >= 0
    && typeof coupon.expiresText === "string";
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

async function walletState(profileId: string) {
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
  return {
    usedKeys: await usedKeys(profileId),
    members: [...members.values()],
    qrViewsRemaining: Math.max(0, 3 - (dailyUsage?.view_count ?? 0)),
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
    const profile = await findOrCreateProfile(body.deviceKey);
    if (profile.isBlocked) return Response.json({ error: "profile_blocked" }, { status: 403 });

    if (body.action === "sync") {
      if (!Array.isArray(body.coupons) || body.coupons.length > 200 || !body.coupons.every(validCoupon)) {
        return Response.json({ error: "invalid_coupons" }, { status: 400 });
      }

      await db.transaction(async (tx) => {
        await tx.update(coupons)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(coupons.ownerId, profile.id));

        for (const coupon of body.coupons as WalletCoupon[]) {
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
      return Response.json({ synced: body.coupons.length, ...(await walletState(profile.id)) });
    }

    if (body.action === "set_sharing" && typeof body.sharing === "boolean") {
      const qrData = body.qrData;
      if (body.sharing && (typeof qrData !== "string"
        || qrData.length > MAX_QR_DATA_LENGTH
        || !qrDataPattern.test(qrData))) {
        return Response.json({ error: "invalid_qr_image" }, { status: 400 });
      }
      await ensureAlphaGroup(profile.id);
      const sql = getSqlClient();
      await sql`
        insert into lidl_cards (owner_id, qr_object_path, is_shared, updated_at)
        values (${profile.id}::uuid, ${body.sharing ? qrData as string : null}, ${body.sharing}, now())
        on conflict (owner_id) do update set
          qr_object_path = case when excluded.is_shared then excluded.qr_object_path else lidl_cards.qr_object_path end,
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

      if (body.action === "mark_used") {
        const now = new Date();
        const updated = await db.update(coupons)
          .set({ usedAt: now, updatedAt: now })
          .where(and(eq(coupons.ownerId, profile.id), inArray(coupons.externalKey, externalKeys)))
          .returning({ id: coupons.id });
        if (updated.length) {
          await db.insert(couponUseEvents).values(updated.map((coupon) => ({
            couponId: coupon.id,
            usedBy: profile.id,
            usedAt: now,
          })));
        }
        return Response.json({ updated: updated.length, usedKeys: await usedKeys(profile.id) });
      }

      const updated = await db.update(coupons)
        .set({ usedAt: null, updatedAt: new Date() })
        .where(and(eq(coupons.ownerId, profile.id), inArray(coupons.externalKey, externalKeys)))
        .returning({ id: coupons.id });
      if (updated.length) {
        await db.update(couponUseEvents)
          .set({ revertedAt: new Date() })
          .where(and(inArray(couponUseEvents.couponId, updated.map((coupon) => coupon.id)), eq(couponUseEvents.usedBy, profile.id)));
      }
      return Response.json({ updated: updated.length, usedKeys: await usedKeys(profile.id) });
    }

    return Response.json({ error: "invalid_action" }, { status: 400 });
  } catch (error) {
    console.error("Coupon wallet write failed", error);
    return Response.json({ error: "database_unavailable" }, { status: 503 });
  }
}

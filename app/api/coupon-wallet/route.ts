import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "@/db";
import { couponUseEvents, coupons, profiles } from "@/db/schema";

export const runtime = "nodejs";

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

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    .returning({ id: profiles.id });
  return profile;
}

async function usedKeys(ownerId: string) {
  const db = getDb();
  const rows = await db.select({ externalKey: coupons.externalKey })
    .from(coupons)
    .where(and(eq(coupons.ownerId, ownerId), isNotNull(coupons.usedAt)));
  return rows.map((row) => row.externalKey);
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
    const [profile] = await db.select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.deviceKey, deviceKey))
      .limit(1);
    if (!profile) {
      return Response.json({ usedKeys: [] });
    }
    return Response.json({ usedKeys: await usedKeys(profile.id) });
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

      return Response.json({ synced: body.coupons.length, usedKeys: await usedKeys(profile.id) });
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

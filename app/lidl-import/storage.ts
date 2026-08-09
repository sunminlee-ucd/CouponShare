export const LIDL_IMPORT_STORAGE_KEY = "couponshare:lidl-active-coupons:v3";

export type LidlImportedCoupon = {
  fingerprint: string;
  title: string;
  discount: string | null;
  maxUnits: number | null;
  expires: string | null;
  validFrom: string | null;
  validUntil: string | null;
  activated: boolean | null;
  imageUrl: string | null;
  capturedAt: string;
};

export type LidlImportPayload = {
  schemaVersion: 2;
  source: { url: string; host: "www.lidl.ie" };
  capturedAt: string;
  detailFailures: number;
  newlyActivated?: number;
  skippedUsed?: number;
  activationFailures?: number;
  coupons: LidlImportedCoupon[];
};

export function activatedPayload(value: unknown): LidlImportPayload | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<LidlImportPayload>;
  if (candidate.schemaVersion !== 2
    || candidate.source?.host !== "www.lidl.ie"
    || !Array.isArray(candidate.coupons)) return null;

  return {
    ...candidate,
    schemaVersion: 2,
    source: candidate.source,
    capturedAt: typeof candidate.capturedAt === "string" ? candidate.capturedAt : new Date().toISOString(),
    detailFailures: typeof candidate.detailFailures === "number" ? candidate.detailFailures : 0,
    newlyActivated: typeof candidate.newlyActivated === "number" ? candidate.newlyActivated : 0,
    skippedUsed: typeof candidate.skippedUsed === "number" ? candidate.skippedUsed : 0,
    activationFailures: typeof candidate.activationFailures === "number" ? candidate.activationFailures : 0,
    coupons: candidate.coupons
      .filter((coupon) => coupon?.activated === true)
      .map((coupon) => ({
        ...coupon,
        maxUnits: typeof coupon.maxUnits === "number" && coupon.maxUnits >= 1
          ? Math.floor(coupon.maxUnits)
          : 1,
      })),
  };
}

export type VoucherType = "5off25" | "10off40" | "10off50";

export type DunnesAutoReviewDecision = {
  autoApprove: boolean;
  reasons: string[];
  detectedVoucherBarcode: string | null;
  detectedVoucherType: VoucherType | null;
  detectedExpiry: string | null;
  detectedMembershipBarcode: string | null;
};

const barcodePattern = /^\d{10,16}$/;

function barcodeCandidates(text: string) {
  return [...new Set((text.match(/(?:\d[\s-]*){10,16}/g) ?? [])
    .map((value) => value.replace(/\D/g, ""))
    .filter((value) => barcodePattern.test(value)))]
    .sort((a, b) => b.length - a.length);
}

function normalizedText(text: string) {
  return text
    .toUpperCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectVoucherTypeFromText(text: string): VoucherType | null {
  const upper = normalizedText(text);
  const hasFiveOff = /(?:€\s*)?5\s*(?:EURO\s*)?OFF\b/.test(upper);
  const hasTenOff = /(?:€\s*)?10\s*(?:EURO\s*)?OFF\b/.test(upper);
  if (hasTenOff && /(?:€\s*)?50\b/.test(upper)) return "10off50";
  if (hasTenOff && /(?:€\s*)?40\b/.test(upper)) return "10off40";
  if (hasFiveOff && /(?:€\s*)?25\b/.test(upper)) return "5off25";
  return null;
}

export function detectVoucherExpiryFromText(text: string, referenceDate = new Date()) {
  const upper = normalizedText(text);
  const match = upper.match(/VALID\s+\d{1,2}\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*-\s*(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/);
  if (!match) return null;
  const months: Record<string, number> = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
  };
  const month = months[match[3]];
  const day = Number(match[2]);
  if (month === undefined || !Number.isInteger(day) || day < 1 || day > 31) return null;
  let result = new Date(Date.UTC(referenceDate.getUTCFullYear(), month, day));
  if (result.getTime() < referenceDate.getTime() - 45 * 24 * 60 * 60 * 1000) {
    result = new Date(Date.UTC(referenceDate.getUTCFullYear() + 1, month, day));
  }
  return result.toISOString().slice(0, 10);
}

function hasDunnesVoucherIdentity(text: string) {
  const upper = normalizedText(text);
  const branded = /\bDUNNES(?:\s+STORES)?\b/.test(upper) || /\bVALUE\s*CLUB\b/.test(upper);
  const couponLanguage = /\bOFF\b/.test(upper) && /\bVALID\b/.test(upper);
  return branded && couponLanguage;
}

function hasValueClubIdentity(text: string) {
  const upper = normalizedText(text);
  return /\bVALUE\s*CLUB\b/.test(upper) || /\bDUNNES(?:\s+STORES)?\b/.test(upper);
}

export function reviewDunnesOcrEvidence(input: {
  voucherType: VoucherType;
  barcode: string;
  expiresOn: string;
  voucherText: string;
  membershipRequired: boolean;
  membershipText?: string | null;
  referenceDate?: Date;
}): DunnesAutoReviewDecision {
  const reasons: string[] = [];
  const voucherBarcodes = barcodeCandidates(input.voucherText);
  const detectedVoucherBarcode = voucherBarcodes[0] ?? null;
  const detectedVoucherType = detectVoucherTypeFromText(input.voucherText);
  const detectedExpiry = detectVoucherExpiryFromText(input.voucherText, input.referenceDate);

  if (!voucherBarcodes.includes(input.barcode)) reasons.push("voucher_barcode_not_read");
  if (detectedVoucherType !== input.voucherType) reasons.push("voucher_type_mismatch");
  if (!hasDunnesVoucherIdentity(input.voucherText)) reasons.push("voucher_identity_unclear");
  if (detectedExpiry !== input.expiresOn) reasons.push("voucher_expiry_mismatch");

  let detectedMembershipBarcode: string | null = null;
  if (input.membershipRequired) {
    const membershipText = input.membershipText ?? "";
    const membershipBarcodes = barcodeCandidates(membershipText);
    detectedMembershipBarcode = membershipBarcodes[0] ?? null;
    if (!detectedMembershipBarcode) reasons.push("membership_barcode_not_read");
    if (!hasValueClubIdentity(membershipText)) reasons.push("membership_identity_unclear");
  }

  return {
    autoApprove: reasons.length === 0,
    reasons,
    detectedVoucherBarcode,
    detectedVoucherType,
    detectedExpiry,
    detectedMembershipBarcode,
  };
}

function imageDataToBuffer(imageData: string) {
  const comma = imageData.indexOf(",");
  if (comma < 0) throw new Error("invalid_image_data");
  return Buffer.from(imageData.slice(comma + 1), "base64");
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number) {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("ocr_timeout")), milliseconds);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function reviewDunnesUploadImages(input: {
  voucherType: VoucherType;
  barcode: string;
  expiresOn: string;
  imageData: string;
  membershipRequired: boolean;
  membershipImageData?: string | null;
}): Promise<DunnesAutoReviewDecision> {
  let worker: { recognize: (image: Buffer) => Promise<{ data: { text?: string } }>; terminate: () => Promise<unknown> } | null = null;
  try {
    const { createWorker } = await import("tesseract.js");
    worker = await withTimeout(createWorker("eng") as Promise<typeof worker extends Promise<infer U> ? U : never>, 6_000) as NonNullable<typeof worker>;
    const voucherResult = await withTimeout(worker.recognize(imageDataToBuffer(input.imageData)), 5_000);
    let membershipText = "";
    if (input.membershipRequired && input.membershipImageData) {
      const membershipResult = await withTimeout(worker.recognize(imageDataToBuffer(input.membershipImageData)), 5_000);
      membershipText = membershipResult.data.text ?? "";
    }
    return reviewDunnesOcrEvidence({
      voucherType: input.voucherType,
      barcode: input.barcode,
      expiresOn: input.expiresOn,
      voucherText: voucherResult.data.text ?? "",
      membershipRequired: input.membershipRequired,
      membershipText,
    });
  } catch (error) {
    console.warn("Dunnes automatic review could not verify an upload", error instanceof Error ? error.message : "unknown_error");
    return {
      autoApprove: false,
      reasons: ["automatic_review_unavailable"],
      detectedVoucherBarcode: null,
      detectedVoucherType: null,
      detectedExpiry: null,
      detectedMembershipBarcode: null,
    };
  } finally {
    if (worker) await worker.terminate().catch(() => undefined);
  }
}

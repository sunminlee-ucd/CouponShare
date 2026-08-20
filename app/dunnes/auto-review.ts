export type VoucherType = "5off25" | "10off40" | "10off50";

export type DunnesAutoReviewDecision = {
  autoApprove: boolean;
  reasons: string[];
  detectedVoucherBarcode: string | null;
  detectedVoucherType: VoucherType | null;
  detectedExpiry: string | null;
  detectedMembershipBarcode: string | null;
  voucherOcrConfidence: number | null;
  membershipOcrConfidence: number | null;
};

const barcodePattern = /^\d{10,16}$/;
const knownDunnesVoucherBarcodePattern = /^(?:227|270)\d{9,10}$/;
const MIN_VOUCHER_OCR_CONFIDENCE = 45;
const MIN_MEMBERSHIP_OCR_CONFIDENCE = 40;

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
    .replace(/\bDUNNE5\b/g, "DUNNES")
    .replace(/\b0FF\b/g, "OFF")
    .replace(/\bVA1ID\b/g, "VALID")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectVoucherTypeFromText(text: string): VoucherType | null {
  const upper = normalizedText(text);
  if (/\b10\s*(?:EURO\s*)?OFF\s*(?:€\s*)?50\b/.test(upper)) return "10off50";
  if (/\b10\s*(?:EURO\s*)?OFF\s*(?:€\s*)?40\b/.test(upper)) return "10off40";
  if (/\b5\s*(?:EURO\s*)?OFF\s*(?:€\s*)?25\b/.test(upper)) return "5off25";
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

function hasDunnesBrand(text: string) {
  return /\bDUNNES(?:\s+STORES?)?\b/.test(normalizedText(text));
}

function spendThresholdForType(type: VoucherType) {
  if (type === "5off25") return 25;
  return type === "10off40" ? 40 : 50;
}

function hasMatchingSpendRule(text: string, type: VoucherType) {
  const upper = normalizedText(text);
  const threshold = spendThresholdForType(type);
  const spendRule = new RegExp(`WHEN\\s+YOU\\s+SPEND\\s+(?:€\\s*)?${threshold}\\s+OR\\s+MORE\\s+ON\\s+GROCERIES`);
  return spendRule.test(upper);
}

function hasTermsMarker(text: string) {
  return /TERMS\s+AND\s+CONDITIONS\s+APPLY/.test(normalizedText(text));
}

function hasCouponStructure(text: string, type: VoucherType) {
  // Real Dunnes screenshots consistently show the spend rule or the terms line.
  // "Expires Today/Sunday" and "Voucher valid for 7 days" are deliberately optional.
  return hasMatchingSpendRule(text, type) || hasTermsMarker(text);
}

function hasKnownVoucherBarcodeShape(barcode: string) {
  // Current real samples are 12-13 digit Dunnes voucher numbers beginning 227 or 270.
  // Unknown formats are not rejected; they are simply left pending for manual review.
  return knownDunnesVoucherBarcodePattern.test(barcode);
}

function hasValueClubIdentity(text: string) {
  const upper = normalizedText(text);
  return /\bVALUE\s*CLUB\b/.test(upper)
    || /\bVALUECLUB\b/.test(upper)
    || (/\bDUNNES(?:\s+STORES?)?\b/.test(upper) && /\bCARD\b/.test(upper));
}

export function reviewDunnesOcrEvidence(input: {
  voucherType: VoucherType;
  barcode: string;
  expiresOn: string;
  voucherText: string;
  membershipRequired: boolean;
  membershipText?: string | null;
  voucherConfidence?: number | null;
  membershipConfidence?: number | null;
  referenceDate?: Date;
}): DunnesAutoReviewDecision {
  const reasons: string[] = [];
  const voucherBarcodes = barcodeCandidates(input.voucherText);
  const detectedVoucherBarcode = voucherBarcodes[0] ?? null;
  const detectedVoucherType = detectVoucherTypeFromText(input.voucherText);
  const detectedExpiry = detectVoucherExpiryFromText(input.voucherText, input.referenceDate);
  const voucherOcrConfidence = typeof input.voucherConfidence === "number" ? input.voucherConfidence : null;
  const membershipOcrConfidence = typeof input.membershipConfidence === "number" ? input.membershipConfidence : null;

  // Reading the exact printed number is our practical proof that the barcode area is clear enough.
  if (!voucherBarcodes.includes(input.barcode)) reasons.push("voucher_barcode_not_read");
  if (!hasKnownVoucherBarcodeShape(input.barcode)) reasons.push("voucher_barcode_shape_unfamiliar");
  if (detectedVoucherType !== input.voucherType) reasons.push("voucher_type_mismatch");
  if (!hasDunnesBrand(input.voucherText)) reasons.push("voucher_identity_unclear");
  if (!hasCouponStructure(input.voucherText, input.voucherType)) reasons.push("voucher_structure_unclear");
  if (detectedExpiry !== input.expiresOn) reasons.push("voucher_expiry_mismatch");
  if (voucherOcrConfidence !== null && voucherOcrConfidence < MIN_VOUCHER_OCR_CONFIDENCE) {
    reasons.push("voucher_ocr_low_confidence");
  }

  let detectedMembershipBarcode: string | null = null;
  if (input.membershipRequired) {
    const membershipText = input.membershipText ?? "";
    const membershipBarcodes = barcodeCandidates(membershipText);
    detectedMembershipBarcode = membershipBarcodes[0] ?? null;
    if (!detectedMembershipBarcode) reasons.push("membership_barcode_not_read");
    if (!hasValueClubIdentity(membershipText)) reasons.push("membership_identity_unclear");
    if (membershipOcrConfidence !== null && membershipOcrConfidence < MIN_MEMBERSHIP_OCR_CONFIDENCE) {
      reasons.push("membership_ocr_low_confidence");
    }
  }

  return {
    autoApprove: reasons.length === 0,
    reasons,
    detectedVoucherBarcode,
    detectedVoucherType,
    detectedExpiry,
    detectedMembershipBarcode,
    voucherOcrConfidence,
    membershipOcrConfidence,
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
  let worker: import("tesseract.js").Worker | null = null;
  try {
    const { createWorker } = await import("tesseract.js");
    worker = await withTimeout(createWorker("eng"), 6_000);
    const voucherResult = await withTimeout(worker.recognize(imageDataToBuffer(input.imageData)), 5_000);
    let membershipText = "";
    let membershipConfidence: number | null = null;
    if (input.membershipRequired && input.membershipImageData) {
      const membershipResult = await withTimeout(worker.recognize(imageDataToBuffer(input.membershipImageData)), 5_000);
      membershipText = membershipResult.data.text ?? "";
      membershipConfidence = typeof membershipResult.data.confidence === "number" ? membershipResult.data.confidence : null;
    }
    return reviewDunnesOcrEvidence({
      voucherType: input.voucherType,
      barcode: input.barcode,
      expiresOn: input.expiresOn,
      voucherText: voucherResult.data.text ?? "",
      membershipRequired: input.membershipRequired,
      membershipText,
      voucherConfidence: typeof voucherResult.data.confidence === "number" ? voucherResult.data.confidence : null,
      membershipConfidence,
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
      voucherOcrConfidence: null,
      membershipOcrConfidence: null,
    };
  } finally {
    if (worker) await worker.terminate().catch(() => undefined);
  }
}

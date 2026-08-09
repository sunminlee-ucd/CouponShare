export type ReceiptItem = {
  id: string;
  name: string;
  price: number;
  priceDetected: boolean;
  quantity?: number;
  unitPrice?: number;
  weightKg?: number;
  discounts: number[];
};

type KnownProduct = {
  id: string;
  name: string;
  aliases: string[];
  price: number;
};

type CouponLike = {
  productId: string;
  productName?: string;
  keywords?: string[];
};

const ignoredItemPrefixes = [
  "TOTAL", "CREDIT CARD", "CASH", "CHANGE", "CASHBACK", "ROUNDING",
  "DEPOSIT", "DEPOSITS", "TOTAL DEPOSITS", "TOTAL SAVINGS", "VAT",
  "TRN-ID", "TRNS NO", "AUTH CODE",
  "CONTACTLESS", "APPROVED", "CUSTOMER COPY", "PLEASE", "VERIFIED",
  "SALE", "EUR", "COPY",
];

const discountLabels = [
  "LIDL PLUS COUPON",
  "LIDL PLUS OFFERS",
  "LIDL PLUS OFFER",
  "SAVINGS",
];

function cleanLine(line: string) {
  return line
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMoney(value: string) {
  const amount = Number(value.replace(/€|\s/g, "").replace(",", "."));
  return Number.isFinite(amount) && Math.abs(amount) < 1000 ? amount : null;
}

function isIgnoredItem(name: string) {
  const upper = name.toUpperCase();
  return ignoredItemPrefixes.some((prefix) => upper === prefix || upper.startsWith(`${prefix} `))
    || /^[ABC]\s+\d+(?:[.,]\d+)?%?\s+VAT\b/.test(upper)
    || /^(?:DATE|TIME|MID|TID)\s*:/.test(upper)
    || /\b(?:FEEDBACK|VOUCHERS?|RECYCLING COSTS)\b/.test(upper)
    || /^\d+\s*[X×]\s*\d/.test(upper)
    || /^\d+(?:[.,]\d+)?\s*KG\s*[X×]/.test(upper)
    || /\bDEPOSIT\b/.test(upper);
}

function cleanProductName(name: string) {
  return name
    .replace(/["'`]\s*0\d{5,}\s*$/g, "")
    .replace(/["'`\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeProductName(value: string) {
  return cleanProductName(value)
    .toUpperCase()
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:KG|G|ML|L|PK|PACK)\b/g, " ")
    .replace(/\b(?:LIDL|PLUS|COUPON|OFFERS?|SAVINGS)\b/g, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stableReceiptId(name: string, index: number) {
  const slug = normalizeProductName(name).toLowerCase().replace(/\s+/g, "-").slice(0, 48) || "item";
  return `receipt-${slug}-${index + 1}`;
}

function knownProductFor(name: string, knownProducts: KnownProduct[]) {
  const normalized = normalizeProductName(name);
  return knownProducts.find((product) => product.aliases.some((alias) => {
    const normalizedAlias = normalizeProductName(alias);
    return normalized === normalizedAlias || normalized.includes(normalizedAlias) || normalizedAlias.includes(normalized);
  }));
}

export function parseLidlReceipt(text: string, knownProducts: KnownProduct[] = []): ReceiptItem[] {
  const lines = text.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const items: ReceiptItem[] = [];
  let currentItem: ReceiptItem | null = null;

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (/^TOTAL(?:\s|$)/.test(upper)) break;
    if (/^[\-=]{5,}$/.test(line)) continue;

    const quantity = line.match(/^(\d+(?:[.,]\d+)?)\s*(KG)?\s*[X×]\s*(\d+(?:[.,]\d+)?)(?:\s+EUR)?$/i);
    if (quantity && currentItem) {
      const count = Number(quantity[1].replace(",", "."));
      const unitPrice = Number(quantity[3].replace(",", "."));
      if (quantity[2]) currentItem.weightKg = count;
      else currentItem.quantity = count;
      currentItem.unitPrice = unitPrice;
      continue;
    }

    const discount = line.match(/^(.+?)\s+(-\s*€?\s*\d{1,3}[.,]\d{2})$/i);
    if (discount && currentItem) {
      const label = discount[1].toUpperCase();
      if (discountLabels.some((candidate) => label.includes(candidate)) || /^MB\b/.test(label)) {
        const amount = parseMoney(discount[2]);
        if (amount !== null) currentItem.discounts.push(Math.abs(amount));
        continue;
      }
    }

    const item = line.match(/^(.+?)\s+(€?\s*\d{1,3}[.,]\d{2})(?:\s+[ABC])?$/i);
    if (!item) continue;
    const name = cleanProductName(item[1]);
    const price = parseMoney(item[2]);
    if (!name || price === null || price < 0 || isIgnoredItem(name)) continue;

    const known = knownProductFor(name, knownProducts);
    currentItem = {
      id: known?.id ?? stableReceiptId(name, items.length),
      name,
      price,
      priceDetected: true,
      discounts: [],
    };
    items.push(currentItem);
  }

  return items;
}

function significantTokens(value: string) {
  return normalizeProductName(value)
    .replace(/YOGHURT/g, "YOGURT")
    .split(" ")
    .filter((token) => token.length >= 3 && !["THE", "WITH", "AND", "FOR"].includes(token));
}

function tokenMatches(left: string, right: string) {
  if (left === right) return true;
  const shorter = Math.min(left.length, right.length);
  let commonPrefix = 0;
  while (commonPrefix < shorter && left[commonPrefix] === right[commonPrefix]) commonPrefix += 1;
  return commonPrefix >= 5 && commonPrefix >= shorter - 2;
}

export function receiptItemMatchesCoupon(item: Pick<ReceiptItem, "id" | "name">, coupon: CouponLike, knownProducts: KnownProduct[] = []) {
  if (item.id === coupon.productId) return true;

  const couponNames = [coupon.productName, ...(coupon.keywords ?? [])].filter((value): value is string => Boolean(value));
  const itemName = normalizeProductName(item.name);
  const knownCoupon = knownProducts.find((product) => product.id === coupon.productId);
  if (knownCoupon) couponNames.push(knownCoupon.name, ...knownCoupon.aliases);

  return couponNames.some((candidate) => {
    const couponName = normalizeProductName(candidate);
    if (!couponName) return false;
    if (itemName === couponName) return true;
    if (Math.min(itemName.length, couponName.length) >= 5 && (itemName.includes(couponName) || couponName.includes(itemName))) return true;

    const itemTokens = significantTokens(itemName);
    const couponTokens = significantTokens(couponName);
    const overlap = couponTokens.filter((token) => itemTokens.some((itemToken) => tokenMatches(itemToken, token))).length;
    const required = Math.min(itemTokens.length, couponTokens.length) === 1 ? 1 : 2;
    return overlap >= required && overlap / Math.max(1, Math.min(itemTokens.length, couponTokens.length)) >= 0.6;
  });
}

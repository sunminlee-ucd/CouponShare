/* global chrome */

const TARGET_PATH = "/prm/promotions-list";

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function redactSensitive(value) {
  return cleanText(value)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email removed]")
    .replace(/(?:\+?353|0)\s*\d(?:[\s-]*\d){7,9}/g, "[phone removed]");
}

function collectText(value, depth = 0) {
  if (depth > 5 || value == null) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap((item) => collectText(item, depth + 1));
  if (typeof value === "object") {
    return Object.entries(value)
      .filter(([key]) => !/(image|icon|url|tracking)/i.test(key))
      .flatMap(([, item]) => collectText(item, depth + 1));
  }
  return [];
}

function findDateValue(value, wanted, depth = 0) {
  if (depth > 5 || value == null || typeof value !== "object") return null;
  for (const [key, item] of Object.entries(value)) {
    if (wanted.test(key) && typeof item === "string") return item;
    const nested = findDateValue(item, wanted, depth + 1);
    if (nested) return nested;
  }
  return null;
}

function basicCoupons(capturedAt) {
  return [...document.querySelectorAll(".promotions .promotion[data-testid]")].map((card) => {
    const id = cleanText(card.dataset.testid);
    const discountValue = cleanText(card.querySelector(".discountContainer .offerBox > p")?.textContent || card.querySelector(".discountContainer p")?.textContent);
    const discountType = cleanText(card.querySelector(".title")?.textContent);
    const controlLabel = cleanText(card.querySelector("button[aria-label*='coupon']")?.getAttribute("aria-label"));
    return {
      id,
      fingerprint: `lidl-${id}`,
      title: redactSensitive(card.querySelector(".description")?.textContent) || "상품명 확인 필요",
      discount: cleanText(`${discountValue} ${discountType}`) || null,
      maxUnits: null,
      expires: cleanText(card.querySelector(".expiration")?.textContent) || null,
      validFrom: null,
      validUntil: null,
      activated: /deactivate/i.test(controlLabel) || card.classList.contains("activated")
        ? true
        : /activate/i.test(controlLabel)
          ? false
          : null,
      imageUrl: card.querySelector(".image img.img")?.src || null,
      capturedAt,
    };
  });
}

async function extractCoupons() {
  const capturedAt = new Date().toISOString();
  const country = cleanText(document.querySelector("#country_code")?.value || "IE").toUpperCase();
  const language = cleanText(document.querySelector("#language")?.value || "en-IE");
  const coupons = basicCoupons(capturedAt).filter((coupon) => coupon.activated === true);
  let detailFailures = 0;

  async function enrich(coupon) {
    try {
      const url = new URL(`${encodeURIComponent(country)}/promotions/${encodeURIComponent(coupon.id)}?language=${encodeURIComponent(language)}`, `${location.origin}/prm/`);
      const response = await fetch(url, { credentials: "include", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(String(response.status));
      const detail = await response.json();
      const detailText = cleanText(collectText(detail).join(" "));
      const unitMatch = detailText.match(/(?:max(?:imum)?\.?|limit(?:ed)?(?:\s+to)?|up\s+to)\s*(\d+)\s*(?:unit|item|product|pack)s?/i)
        || detailText.match(/(\d+)\s*(?:unit|item|product|pack)s?\s*(?:per\s+coupon|maximum|max|limit)/i)
        || detailText.match(/(?:one|single)\s*(?:unit|item|product|pack)|coupon\s+can\s+only\s+be\s+used\s+once/i);
      coupon.maxUnits = unitMatch ? (unitMatch[1] ? Number(unitMatch[1]) : 1) : null;
      coupon.validFrom = findDateValue(detail, /^(startValidityDate|validFrom|startDate)$/i);
      coupon.validUntil = findDateValue(detail, /^(endValidityDate|validUntil|endDate)$/i);
    } catch {
      detailFailures += 1;
    }
  }

  for (let index = 0; index < coupons.length; index += 3) {
    await Promise.all(coupons.slice(index, index + 3).map(enrich));
  }

  return {
    schemaVersion: 2,
    source: { url: location.href, host: location.host },
    capturedAt,
    detailFailures,
    coupons: coupons.map(({ id: _id, ...coupon }) => coupon),
  };
}

async function refreshExtraction() {
  if (!location.pathname.startsWith(TARGET_PATH)) return { ok: false, reason: "wrong-page" };
  const payload = await extractCoupons();
  await chrome.storage.local.set({ latestLidlImport: payload });
  return { ok: true, count: payload.coupons.length, payload };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "couponshare-rescan") return;
  refreshExtraction().then(sendResponse);
  return true;
});

if (location.pathname.startsWith(TARGET_PATH)) {
  window.setTimeout(refreshExtraction, 1800);
}

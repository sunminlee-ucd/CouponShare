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
      maxUnits: 1,
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
  const coupons = basicCoupons(capturedAt).filter((coupon) => coupon.activated === true);

  return {
    schemaVersion: 2,
    source: { url: location.href, host: location.host },
    capturedAt,
    detailFailures: 0,
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

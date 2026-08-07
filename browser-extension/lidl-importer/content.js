/* global chrome */

const TARGET_PATH = "/prm/promotions-list";
const CARD_SELECTORS = [
  "article",
  "[role='listitem']",
  "[data-testid*='promotion' i]",
  "[data-testid*='coupon' i]",
  "[class*='promotion-card' i]",
  "[class*='coupon-card' i]",
  "[class*='offer-card' i]",
];

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function redactSensitive(value) {
  return cleanText(value)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email removed]")
    .replace(/(?:\+?353|0)\s*\d(?:[\s-]*\d){7,9}/g, "[phone removed]");
}

function visible(element) {
  const style = window.getComputedStyle(element);
  const bounds = element.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && bounds.width > 40 && bounds.height > 20;
}

function hasCouponSignal(text) {
  return /(activate|activated|coupon|valid|expiry|expires|save|off|discount|lidl plus|€|\d+\s*%)/i.test(text);
}

function candidateCards() {
  const candidates = [...document.querySelectorAll(CARD_SELECTORS.join(","))]
    .filter(visible)
    .map((element) => ({ element, text: redactSensitive(element.innerText) }))
    .filter(({ text }) => text.length >= 12 && text.length <= 1200 && hasCouponSignal(text));

  const unique = new Map();
  for (const candidate of candidates.sort((a, b) => a.text.length - b.text.length)) {
    const key = candidate.text.toLocaleLowerCase();
    if (![...unique.keys()].some((existing) => existing.includes(key) || key.includes(existing))) {
      unique.set(key, candidate);
    }
  }
  return [...unique.values()];
}

function findTitle(element, text) {
  const heading = element.querySelector("h1,h2,h3,h4,[data-testid*='title' i],[class*='title' i],strong");
  const headingText = redactSensitive(heading?.textContent);
  if (headingText.length >= 2 && headingText.length <= 160) return headingText;
  return text.split(/(?<=[.!?])\s+|\s{2,}/)[0].slice(0, 160) || "제목 확인 필요";
}

function parseDiscount(text) {
  const patterns = [
    /(?:save|discount|off)\s*€\s*(\d+(?:[.,]\d{1,2})?)/i,
    /€\s*(\d+(?:[.,]\d{1,2})?)\s*(?:off|discount)/i,
    /(\d{1,2})\s*%\s*(?:off|discount)?/i,
    /(?:save|discount)\s*(\d{1,2})\s*%/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return null;
}

function parseMaxUnits(text) {
  const match = text.match(/(?:maximum|max\.?|up to|limited to)\s*(\d+)\s*(?:item|items|unit|units|product|products)?/i)
    ?? text.match(/(\d+)\s*(?:item|items|unit|units)\s*(?:maximum|max|only)/i);
  return match ? Number(match[1]) : null;
}

function parseExpiry(text) {
  const match = text.match(/(?:valid\s*(?:until|to)|expires?|expiry)\s*[:-]?\s*([A-Za-z]{3,9}\s+\d{1,2}(?:,?\s+\d{4})?|\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?)/i)
    ?? text.match(/(\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?)\s*(?:-|–|to)\s*(\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?)/i);
  return match ? cleanText(match[0]) : null;
}

function parseActivated(text, element) {
  const controlText = redactSensitive([...element.querySelectorAll("button,[role='button']")].map((node) => node.textContent).join(" "));
  if (/(activated|deactivate)/i.test(controlText || text)) return true;
  if (/\bactivate\b/i.test(controlText || text)) return false;
  return null;
}

function fingerprint(text) {
  let hash = 2166136261;
  for (const character of text.toLocaleLowerCase()) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `lidl-${(hash >>> 0).toString(36)}`;
}

function extractCoupons() {
  const capturedAt = new Date().toISOString();
  const coupons = candidateCards().map(({ element, text }) => ({
    fingerprint: fingerprint(text),
    title: findTitle(element, text),
    discount: parseDiscount(text),
    maxUnits: parseMaxUnits(text),
    expires: parseExpiry(text),
    activated: parseActivated(text, element),
    capturedAt,
  }));

  return {
    schemaVersion: 1,
    source: { url: location.href, host: location.host },
    capturedAt,
    coupons,
  };
}

async function refreshExtraction() {
  if (!location.pathname.startsWith(TARGET_PATH)) return { ok: false, reason: "wrong-page" };
  const payload = extractCoupons();
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
  let timer;
  const observer = new MutationObserver(() => {
    window.clearTimeout(timer);
    timer = window.setTimeout(refreshExtraction, 1200);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

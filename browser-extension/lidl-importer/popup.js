/* global chrome */

const LIDL_URL = "https://www.lidl.ie/prm/promotions-list";
const statusElement = document.querySelector("#status");
const downloadButton = document.querySelector("#download");
let latestPayload = null;

function showPayload(payload) {
  latestPayload = payload ?? null;
  const count = payload?.coupons?.length ?? 0;
  statusElement.textContent = count
    ? `${count}개 쿠폰 요소를 찾았습니다. JSON을 내려받아 CouponShare에서 확인하세요.`
    : "아직 쿠폰을 찾지 못했습니다. Lidl 로그인 후 프로모션 목록을 열고 다시 추출하세요.";
  downloadButton.disabled = count === 0;
}

async function loadStored() {
  const stored = await chrome.storage.local.get("latestLidlImport");
  showPayload(stored.latestLidlImport);
}

document.querySelector("#open").addEventListener("click", () => chrome.tabs.create({ url: LIDL_URL }));

document.querySelector("#rescan").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith("https://www.lidl.ie/")) {
    statusElement.textContent = "먼저 Lidl 프로모션 페이지를 열어 주세요.";
    return;
  }
  try {
    const result = await chrome.tabs.sendMessage(tab.id, { type: "couponshare-rescan" });
    if (result?.payload) showPayload(result.payload);
    else statusElement.textContent = "프로모션 목록 페이지에서 다시 시도해 주세요.";
  } catch {
    statusElement.textContent = "페이지를 새로고침한 뒤 다시 추출해 주세요.";
  }
});

downloadButton.addEventListener("click", async () => {
  if (!latestPayload) return;
  const blob = new Blob([JSON.stringify(latestPayload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  await chrome.downloads.download({ url, filename: `couponshare-lidl-${new Date().toISOString().slice(0, 10)}.json`, saveAs: true });
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
});

loadStored();

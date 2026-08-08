import type { LidlImportPayload } from "./storage";

function runLidlImport(targetOrigin: string) {
  try {
    const clean = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
    if (location.hostname !== "www.lidl.ie" || !location.pathname.startsWith("/prm/promotions-list")) {
      throw new Error("Lidl coupon list page에서 실행해 주세요.");
    }

    const capturedAt = new Date().toISOString();
    const cards = Array.from(document.querySelectorAll<HTMLElement>(".promotions .promotion[data-testid]"));
    if (!cards.length) throw new Error("Coupon을 찾지 못했습니다. 로그인 후 목록이 모두 보이면 다시 실행해 주세요.");

    const coupons = cards.map((card) => {
      const id = clean(card.dataset.testid);
      const value = clean(card.querySelector(".discountContainer .offerBox > p")?.textContent || card.querySelector(".discountContainer p")?.textContent);
      const type = clean(card.querySelector(".title")?.textContent);
      const controlLabel = clean(card.querySelector("button[aria-label*='coupon']")?.getAttribute("aria-label"));
      const activated = /deactivate/i.test(controlLabel) || card.classList.contains("activated")
        ? true
        : /activate/i.test(controlLabel)
          ? false
          : null;
      return {
        fingerprint: `lidl-${id}`,
        title: clean(card.querySelector(".description")?.textContent) || "Product name unavailable",
        discount: clean(`${value} ${type}`) || null,
        maxUnits: 1,
        expires: clean(card.querySelector(".expiration")?.textContent) || null,
        validFrom: null,
        validUntil: null,
        activated,
        imageUrl: null,
        capturedAt,
      };
    }).filter((coupon) => coupon.activated === true);

    if (!coupons.length) throw new Error("Activated 상태의 coupon이 없습니다.");

    const payload: LidlImportPayload = {
      schemaVersion: 2,
      source: { url: `${location.origin}${location.pathname}`, host: "www.lidl.ie" },
      capturedAt,
      detailFailures: 0,
      coupons,
    };
    location.assign(`${targetOrigin}/lidl-import#payload=${encodeURIComponent(JSON.stringify(payload))}`);
  } catch (error) {
    alert(error instanceof Error ? error.message : "Coupon을 가져오지 못했습니다.");
  }
}

export function buildLidlBookmarklet(targetOrigin: string, _compactLoader = false) {
  return `javascript:(${runLidlImport.toString()})(${JSON.stringify(targetOrigin)});void 0`;
}

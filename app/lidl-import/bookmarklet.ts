import type { LidlImportPayload } from "./storage";

function runLidlImport(targetOrigin: string) {
  void (async () => {
    const clean = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
    const cardSelector = ".promotions .promotion[data-testid]";
    const overlay = document.createElement("div");
    overlay.setAttribute("role", "status");
    overlay.style.cssText = "position:fixed;z-index:2147483647;left:16px;right:16px;bottom:18px;padding:16px 18px;border-radius:14px;background:#10271a;color:#fff;font:700 14px/1.4 system-ui,-apple-system,sans-serif;box-shadow:0 12px 40px #0005;text-align:center";
    overlay.textContent = "CouponShare: checking coupons...";
    document.body.appendChild(overlay);

    try {
      if (location.hostname !== "www.lidl.ie" || !location.pathname.startsWith("/prm/promotions-list")) {
        throw new Error("Lidl coupon list page에서 실행해 주세요.");
      }

      const getCards = () => Array.from(document.querySelectorAll<HTMLElement>(cardSelector));
      const getCard = (id: string) => getCards().find((card) => clean(card.dataset.testid) === id);
      const getControlLabel = (card: HTMLElement) => clean(card.querySelector("button[aria-label*='coupon']")?.getAttribute("aria-label"));
      const isActivated = (card: HTMLElement) => /deactivate\s+coupon/i.test(getControlLabel(card)) || card.classList.contains("activated");
      const isUnavailable = (card: HTMLElement) => {
        const labels = Array.from(card.querySelectorAll<HTMLElement>("[aria-label], img[alt]"))
          .map((element) => element.getAttribute("aria-label") || element.getAttribute("alt"))
          .join(" ");
        const state = clean(`${card.className} ${labels} ${card.querySelector(".status, .expiration, .badge")?.textContent}`);
        const activateButton = Array.from(card.querySelectorAll<HTMLButtonElement>("button"))
          .find((button) => /^activate\s+coupon\b/i.test(clean(button.getAttribute("aria-label"))));
        return /\b(?:redeemed|expired)\b|already\s+(?:been\s+)?used|coupon\s+(?:has\s+been\s+)?used|no\s+longer\s+(?:valid|available)/i.test(state)
          || Boolean(activateButton && (activateButton.disabled || activateButton.getAttribute("aria-disabled") === "true"));
      };
      const getActivateButton = (card: HTMLElement) => Array.from(card.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => /^activate\s+coupon\b/i.test(clean(button.getAttribute("aria-label")))
          && !button.disabled
          && button.getAttribute("aria-disabled") !== "true");
      const delay = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

      const initialCards = getCards();
      if (!initialCards.length) throw new Error("Coupon을 찾지 못했습니다. 로그인 후 목록이 모두 보이면 다시 실행해 주세요.");

      const initiallyActivated = new Set(initialCards.filter((card) => isActivated(card) && !isUnavailable(card)).map((card) => clean(card.dataset.testid)));
      const skippedUsedIds = new Set(initialCards.filter(isUnavailable).map((card) => clean(card.dataset.testid)));
      const activationIds = initialCards
        .filter((card) => !isActivated(card) && !isUnavailable(card) && Boolean(getActivateButton(card)))
        .map((card) => clean(card.dataset.testid));

      for (let index = 0; index < activationIds.length; index += 1) {
        const card = getCard(activationIds[index]);
        const button = card && getActivateButton(card);
        if (button) button.click();
        overlay.textContent = `CouponShare: activating coupons ${index + 1}/${activationIds.length}`;
        await delay(120);
      }

      for (let attempt = 0; attempt < 60; attempt += 1) {
        const pending = activationIds.filter((id) => {
          const card = getCard(id);
          return card && !isActivated(card) && !isUnavailable(card);
        });
        if (!pending.length) break;
        overlay.textContent = `CouponShare: waiting for ${pending.length} activation${pending.length === 1 ? "" : "s"}...`;
        await delay(100);
      }

      const capturedAt = new Date().toISOString();
      const availableCards = getCards().filter((card) => isActivated(card) && !isUnavailable(card));
      const coupons = availableCards.map((card) => {
        const id = clean(card.dataset.testid);
        const value = clean(card.querySelector(".discountContainer .offerBox > p")?.textContent || card.querySelector(".discountContainer p")?.textContent);
        const type = clean(card.querySelector(".title")?.textContent);
        return {
          fingerprint: `lidl-${id}`,
          title: clean(card.querySelector(".description")?.textContent) || "Product name unavailable",
          discount: clean(`${value} ${type}`) || null,
          maxUnits: 1,
          expires: clean(card.querySelector(".expiration")?.textContent) || null,
          validFrom: null,
          validUntil: null,
          activated: true,
          imageUrl: null,
          capturedAt,
        };
      });

      if (!coupons.length) throw new Error("사용 가능한 활성 coupon이 없습니다.");

      const activatedIds = new Set(availableCards.map((card) => clean(card.dataset.testid)));
      const newlyActivated = activationIds.filter((id) => activatedIds.has(id) && !initiallyActivated.has(id)).length;
      const activationFailures = activationIds.filter((id) => !activatedIds.has(id)).length;
      const payload: LidlImportPayload = {
        schemaVersion: 2,
        source: { url: `${location.origin}${location.pathname}`, host: "www.lidl.ie" },
        capturedAt,
        detailFailures: 0,
        newlyActivated,
        skippedUsed: skippedUsedIds.size,
        activationFailures,
        coupons,
      };
      overlay.textContent = `CouponShare: ${coupons.length} coupons ready. Returning...`;
      await delay(250);
      location.assign(`${targetOrigin}/lidl-import#payload=${encodeURIComponent(JSON.stringify(payload))}`);
    } catch (error) {
      overlay.style.background = "#7a2e22";
      overlay.textContent = error instanceof Error ? error.message : "Coupon을 가져오지 못했습니다.";
      window.setTimeout(() => overlay.remove(), 7000);
    }
  })();
}

export function buildLidlBookmarklet(targetOrigin: string, _compactLoader = false) {
  return `javascript:(${runLidlImport.toString()})(${JSON.stringify(targetOrigin)});void 0`;
}

import type { LidlImportPayload } from "./storage";

function runLidlImport(targetOrigin: string) {
  void (async () => {
    const clean = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
    const overlay = document.createElement("div");
    overlay.setAttribute("role", "status");
    overlay.style.cssText = "position:fixed;z-index:2147483647;left:16px;right:16px;bottom:18px;padding:16px 18px;border-radius:14px;background:#10271a;color:#fff;font:700 14px/1.4 system-ui,-apple-system,sans-serif;box-shadow:0 12px 40px #0005;text-align:center";
    overlay.textContent = "CouponShare: 쿠폰 목록을 확인하고 있어요…";
    document.body.appendChild(overlay);

    try {
      if (location.hostname !== "www.lidl.ie" || !location.pathname.startsWith("/prm/promotions-list")) {
        throw new Error("Lidl 쿠폰 목록 화면에서 실행해 주세요.");
      }

      const cards = Array.from(document.querySelectorAll<HTMLElement>(".promotions .promotion[data-testid]"));
      if (!cards.length) {
        throw new Error("쿠폰을 찾지 못했습니다. 로그인 후 쿠폰 목록이 모두 보이면 다시 실행해 주세요.");
      }

      const capturedAt = new Date().toISOString();
      const country = clean(document.querySelector<HTMLInputElement>("#country_code")?.value || "IE").toUpperCase();
      const language = clean(document.querySelector<HTMLInputElement>("#language")?.value || "en-IE");

      const coupons = cards.map((card) => {
        const id = clean(card.dataset.testid);
        const title = clean(card.querySelector(".description")?.textContent);
        const discountValue = clean(card.querySelector(".discountContainer .offerBox > p")?.textContent || card.querySelector(".discountContainer p")?.textContent);
        const discountType = clean(card.querySelector(".title")?.textContent);
        const controlLabel = clean(card.querySelector("button[aria-label*='coupon']")?.getAttribute("aria-label"));
        const imageUrl = card.querySelector<HTMLImageElement>(".image img.img")?.src || null;
        return {
          id,
          fingerprint: `lidl-${id}`,
          title: title || "상품명 확인 필요",
          discount: clean(`${discountValue} ${discountType}`) || null,
          maxUnits: null as number | null,
          expires: clean(card.querySelector(".expiration")?.textContent) || null,
          validFrom: null as string | null,
          validUntil: null as string | null,
          activated: /deactivate/i.test(controlLabel) || card.classList.contains("activated")
            ? true
            : /activate/i.test(controlLabel)
              ? false
              : null,
          imageUrl,
          capturedAt,
        };
      });

      const activatedCoupons = coupons.filter((coupon) => coupon.activated === true);
      let completed = 0;
      let detailFailures = 0;
      const collectText = (value: unknown, depth = 0): string[] => {
        if (depth > 5 || value == null) return [];
        if (typeof value === "string") return [value];
        if (Array.isArray(value)) return value.flatMap((item) => collectText(item, depth + 1));
        if (typeof value === "object") {
          return Object.entries(value as Record<string, unknown>)
            .filter(([key]) => !/(image|icon|url|tracking)/i.test(key))
            .flatMap(([, item]) => collectText(item, depth + 1));
        }
        return [];
      };
      const findDateValue = (value: unknown, wanted: RegExp, depth = 0): string | null => {
        if (depth > 5 || value == null || typeof value !== "object") return null;
        for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
          if (wanted.test(key) && typeof item === "string") return item;
          const nested = findDateValue(item, wanted, depth + 1);
          if (nested) return nested;
        }
        return null;
      };

      const enrichCoupon = async (coupon: typeof coupons[number]) => {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 8000);
        try {
          const detailUrl = new URL(
            `${encodeURIComponent(country)}/promotions/${encodeURIComponent(coupon.id)}?language=${encodeURIComponent(language)}`,
            `${location.origin}/prm/`,
          );
          const response = await fetch(detailUrl, {
            credentials: "include",
            headers: { Accept: "application/json" },
            signal: controller.signal,
          });
          if (!response.ok) throw new Error(String(response.status));
          const detail: unknown = await response.json();
          const detailText = clean(collectText(detail).join(" "));
          const unitMatch = detailText.match(/(?:max(?:imum)?\.?|limit(?:ed)?(?:\s+to)?|up\s+to)\s*(\d+)\s*(?:unit|item|product|pack)s?/i)
            || detailText.match(/(\d+)\s*(?:unit|item|product|pack)s?\s*(?:per\s+coupon|maximum|max|limit)/i)
            || detailText.match(/(?:one|single)\s*(?:unit|item|product|pack)|coupon\s+can\s+only\s+be\s+used\s+once/i);
          coupon.maxUnits = unitMatch ? (unitMatch[1] ? Number(unitMatch[1]) : 1) : null;
          coupon.validFrom = findDateValue(detail, /^(startValidityDate|validFrom|startDate)$/i);
          coupon.validUntil = findDateValue(detail, /^(endValidityDate|validUntil|endDate)$/i);
        } catch {
          detailFailures += 1;
        } finally {
          window.clearTimeout(timeout);
          completed += 1;
          overlay.textContent = `CouponShare: 활성 쿠폰 상세 조건 확인 중 ${completed}/${activatedCoupons.length}`;
        }
      };

      for (let index = 0; index < activatedCoupons.length; index += 3) {
        await Promise.all(activatedCoupons.slice(index, index + 3).map(enrichCoupon));
      }

      const payload: LidlImportPayload = {
        schemaVersion: 2,
        source: { url: `${location.origin}${location.pathname}`, host: "www.lidl.ie" },
        capturedAt,
        detailFailures,
        coupons: activatedCoupons.map((coupon) => ({
          fingerprint: coupon.fingerprint,
          title: coupon.title,
          discount: coupon.discount,
          maxUnits: coupon.maxUnits,
          expires: coupon.expires,
          validFrom: coupon.validFrom,
          validUntil: coupon.validUntil,
          activated: true,
          imageUrl: null,
          capturedAt: coupon.capturedAt,
        })),
      };
      const encoded = encodeURIComponent(JSON.stringify(payload));
      const destination = `${targetOrigin}/lidl-import#payload=${encoded}`;
      const returnLink = document.createElement("a");
      returnLink.href = destination;
      returnLink.textContent = "CouponShare로 돌아가기";
      returnLink.style.cssText = "display:inline-block;margin-left:8px;padding:8px 12px;border-radius:9px;background:#d7f43b;color:#10271a;text-decoration:none;font-weight:900";
      overlay.replaceChildren(document.createTextNode("가져오기 완료. 자동으로 이동합니다."), returnLink);
      window.setTimeout(() => location.assign(destination), 150);
    } catch (error) {
      overlay.style.background = "#7a2e22";
      overlay.textContent = error instanceof Error ? error.message : "쿠폰을 가져오지 못했습니다.";
      window.setTimeout(() => overlay.remove(), 7000);
    }
  })();
}

function runAndroidLidlImport(targetOrigin: string) {
  void (async () => {
    const clean = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
    if (location.hostname !== "www.lidl.ie" || !location.pathname.startsWith("/prm/promotions-list")) {
      throw new Error("Lidl 쿠폰 목록 화면에서 실행해 주세요.");
    }
    const capturedAt = new Date().toISOString();
    const cards = Array.from(document.querySelectorAll<HTMLElement>(".promotions .promotion[data-testid].activated"));
    const coupons = cards.map((card) => {
      const id = clean(card.dataset.testid);
      const value = clean(card.querySelector(".discountContainer .offerBox > p")?.textContent || card.querySelector(".discountContainer p")?.textContent);
      const type = clean(card.querySelector(".title")?.textContent);
      return {
        id,
        fingerprint: `lidl-${id}`,
        title: clean(card.querySelector(".description")?.textContent) || "상품명 확인 필요",
        discount: clean(`${value} ${type}`) || null,
        maxUnits: null as number | null,
        expires: clean(card.querySelector(".expiration")?.textContent) || null,
        activated: true,
        capturedAt,
      };
    });
    if (!coupons.length) throw new Error("Activated 상태의 쿠폰이 없습니다.");
    let detailFailures = 0;
    await Promise.all(coupons.map(async (coupon) => {
      try {
        const response = await fetch(`${location.origin}/prm/IE/promotions/${encodeURIComponent(coupon.id)}?language=en-IE`, { credentials: "include", signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new Error(String(response.status));
        const detail = await response.text();
        const units = detail.match(/(?:max(?:imum)?\.?|limit(?:ed)?(?:\s+to)?|up\s+to)\s*(\d+)\s*(?:unit|item|product|pack)s?/i)
          || detail.match(/(\d+)\s*(?:unit|item|product|pack)s?\s*(?:per\s+coupon|maximum|max|limit)/i)
          || detail.match(/(?:one|single)\s*(?:unit|item|product|pack)|coupon\s+can\s+only\s+be\s+used\s+once/i);
        coupon.maxUnits = units ? (units[1] ? Number(units[1]) : 1) : null;
      } catch {
        detailFailures += 1;
      }
    }));
    const payload = {
      schemaVersion: 2,
      source: { url: `${location.origin}${location.pathname}`, host: "www.lidl.ie" },
      capturedAt,
      detailFailures,
      coupons: coupons.map(({ id: _id, ...coupon }) => coupon),
    };
    location.assign(`${targetOrigin}/lidl-import#payload=${encodeURIComponent(JSON.stringify(payload))}`);
  })().catch((error) => alert(error instanceof Error ? error.message : "쿠폰을 가져오지 못했습니다."));
}

export function buildLidlBookmarklet(targetOrigin: string, compactLoader = false) {
  if (compactLoader) {
    return `javascript:(${runAndroidLidlImport.toString()})(${JSON.stringify(targetOrigin)});void 0`;
  }
  return `javascript:(${runLidlImport.toString()})(${JSON.stringify(targetOrigin)});void 0`;
}

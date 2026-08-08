(() => {
  const script = document.currentScript;
  const targetOrigin = script ? new URL(script.src).origin : "https://couponshare-ireland.sunminlee.chatgpt.site";
  const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
  const overlay = document.createElement("div");
  overlay.setAttribute("role", "status");
  overlay.style.cssText = "position:fixed;z-index:2147483647;left:16px;right:16px;bottom:18px;padding:16px 18px;border-radius:14px;background:#10271a;color:#fff;font:700 14px/1.4 system-ui,-apple-system,sans-serif;box-shadow:0 12px 40px #0005;text-align:center";
  overlay.textContent = "CouponShare: 쿠폰 목록을 확인하고 있어요…";
  document.body.appendChild(overlay);

  void (async () => {
    try {
      if (location.hostname !== "www.lidl.ie" || !location.pathname.startsWith("/prm/promotions-list")) {
        throw new Error("Lidl 쿠폰 목록 화면에서 실행해 주세요.");
      }

      const cards = Array.from(document.querySelectorAll(".promotions .promotion[data-testid]"));
      if (!cards.length) throw new Error("활성 쿠폰을 찾지 못했습니다. 로그인 후 쿠폰 목록이 모두 보일 때 다시 실행해 주세요.");

      const capturedAt = new Date().toISOString();
      const country = clean(document.querySelector("#country_code")?.value || "IE").toUpperCase();
      const language = clean(document.querySelector("#language")?.value || "en-IE");
      const coupons = cards.map((card) => {
        const id = clean(card.dataset.testid);
        const discountValue = clean(card.querySelector(".discountContainer .offerBox > p")?.textContent || card.querySelector(".discountContainer p")?.textContent);
        const discountType = clean(card.querySelector(".title")?.textContent);
        const controlLabel = clean(card.querySelector("button[aria-label*='coupon']")?.getAttribute("aria-label"));
        return {
          id,
          fingerprint: `lidl-${id}`,
          title: clean(card.querySelector(".description")?.textContent) || "상품명 확인 필요",
          discount: clean(`${discountValue} ${discountType}`) || null,
          maxUnits: null,
          expires: clean(card.querySelector(".expiration")?.textContent) || null,
          validFrom: null,
          validUntil: null,
          activated: /deactivate/i.test(controlLabel) || card.classList.contains("activated"),
          imageUrl: null,
          capturedAt,
        };
      }).filter((coupon) => coupon.activated === true);

      if (!coupons.length) throw new Error("Activated 상태의 쿠폰이 없습니다. Lidl에서 쿠폰을 활성화한 뒤 다시 실행해 주세요.");

      const collectText = (value, depth = 0) => {
        if (depth > 5 || value == null) return [];
        if (typeof value === "string") return [value];
        if (Array.isArray(value)) return value.flatMap((item) => collectText(item, depth + 1));
        if (typeof value === "object") {
          return Object.entries(value)
            .filter(([key]) => !/(image|icon|url|tracking)/i.test(key))
            .flatMap(([, item]) => collectText(item, depth + 1));
        }
        return [];
      };
      const findDateValue = (value, wanted, depth = 0) => {
        if (depth > 5 || value == null || typeof value !== "object") return null;
        for (const [key, item] of Object.entries(value)) {
          if (wanted.test(key) && typeof item === "string") return item;
          const nested = findDateValue(item, wanted, depth + 1);
          if (nested) return nested;
        }
        return null;
      };

      let completed = 0;
      let detailFailures = 0;
      const enrich = async (coupon) => {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 8000);
        try {
          const url = new URL(`${encodeURIComponent(country)}/promotions/${encodeURIComponent(coupon.id)}?language=${encodeURIComponent(language)}`, `${location.origin}/prm/`);
          const response = await fetch(url, { credentials: "include", headers: { Accept: "application/json" }, signal: controller.signal });
          if (!response.ok) throw new Error(String(response.status));
          const detail = await response.json();
          const detailText = clean(collectText(detail).join(" "));
          const unitMatch = detailText.match(/(?:max(?:imum)?\.?\s*)(\d+)\s*(?:unit|item|product)s?(?:\s*per\s*coupon)?/i)
            || detailText.match(/only\s+appl(?:y|ies)\s+to\s+(?:one|1)\s+unit/i);
          coupon.maxUnits = unitMatch ? (unitMatch[1] ? Number(unitMatch[1]) : 1) : null;
          coupon.validFrom = findDateValue(detail, /^(startValidityDate|validFrom|startDate)$/i);
          coupon.validUntil = findDateValue(detail, /^(endValidityDate|validUntil|endDate)$/i);
        } catch {
          detailFailures += 1;
        } finally {
          window.clearTimeout(timeout);
          completed += 1;
          overlay.textContent = `CouponShare: 활성 쿠폰 상세 조건 확인 중 ${completed}/${coupons.length}`;
        }
      };

      for (let index = 0; index < coupons.length; index += 3) {
        await Promise.all(coupons.slice(index, index + 3).map(enrich));
      }

      const payload = {
        schemaVersion: 2,
        source: { url: `${location.origin}${location.pathname}`, host: "www.lidl.ie" },
        capturedAt,
        detailFailures,
        coupons: coupons.map(({ id, ...coupon }) => coupon),
      };
      const destination = `${targetOrigin}/lidl-import#payload=${encodeURIComponent(JSON.stringify(payload))}`;
      const returnLink = document.createElement("a");
      returnLink.href = destination;
      returnLink.textContent = "CouponShare로 돌아가기";
      returnLink.style.cssText = "display:inline-block;margin-left:8px;padding:8px 12px;border-radius:9px;background:#d7f43b;color:#10271a;text-decoration:none;font-weight:900";
      overlay.replaceChildren(document.createTextNode("가져오기 완료. 자동으로 이동합니다."), returnLink);
      window.setTimeout(() => location.assign(destination), 150);
    } catch (error) {
      overlay.style.background = "#7a2e22";
      overlay.textContent = error instanceof Error ? error.message : "쿠폰을 가져오지 못했습니다.";
    }
  })();
})();

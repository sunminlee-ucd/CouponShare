"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { type AppLanguage, useLanguage } from "./i18n";

type GuardTarget = {
  element: Element;
  requiredTotal: number;
};

type GuardCopy = {
  required: (total: number) => string;
  order: string;
  penalty: string;
};

const COPY: Record<AppLanguage, GuardCopy> = {
  ko: {
    required: (total) => `할인 전 €${total} 이상 구매 필수!`,
    order: "ValueClub Card 먼저 → 할인쿠폰 나중",
    penalty: "주의: 2번 이상 위반 시 강제 탈퇴 처리됩니다.",
  },
  en: {
    required: (total) => `At least €${total} before discount!`,
    order: "ValueClub Card first → discount voucher second",
    penalty: "Warning: 2 or more violations will result in account removal.",
  },
  fa: {
    required: (total) => `مبلغ قبل از تخفیف باید حداقل €${total} باشد!`,
    order: "ابتدا ValueClub Card ← سپس ووچر تخفیف",
    penalty: "هشدار: با ۲ بار یا بیشتر تخلف، حساب شما حذف می‌شود.",
  },
  ja: {
    required: (total) => `割引前に€${total}以上の購入が必須です！`,
    order: "ValueClub Cardを先に → 割引バウチャーを後に",
    penalty: "注意：2回以上違反するとアカウントを強制退会処理します。",
  },
};

function requiredTotalFromText(text: string | null | undefined) {
  const normalized = (text ?? "").replace(/\s+/g, " ").toUpperCase();
  if (normalized.includes("€5") && normalized.includes("€25")) return 30;
  if (normalized.includes("€10") && normalized.includes("€40")) return 50;
  if (normalized.includes("€10") && normalized.includes("€50")) return 60;
  return null;
}

function WarningBanner({ requiredTotal, language, sticky = false }: { requiredTotal: number; language: AppLanguage; sticky?: boolean }) {
  const copy = COPY[language];
  return (
    <aside className={`membership-rule-banner${sticky ? " sticky" : ""}`} role="alert" aria-live="polite">
      <strong className="membership-rule-main">{copy.required(requiredTotal)}</strong>
      <span className="membership-rule-order">{copy.order}</span>
      <small className="membership-rule-penalty">{copy.penalty}</small>
    </aside>
  );
}

export default function DunnesMembershipGuard() {
  const pathname = usePathname();
  const { language } = useLanguage();
  const [selectedRequiredTotal, setSelectedRequiredTotal] = useState<number | null>(null);
  const [reservationTarget, setReservationTarget] = useState<GuardTarget | null>(null);
  const [revealTarget, setRevealTarget] = useState<GuardTarget | null>(null);

  useEffect(() => {
    if (!pathname.startsWith("/dunnes")) return;

    function captureReservation(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button");
      const item = target.closest(".dunnes-list-item");
      if (!(button instanceof HTMLButtonElement) || !item || button.disabled) return;

      const membershipRequired = Boolean(item.querySelector(".dunnes-membership-badge.required"));
      if (!membershipRequired) {
        setSelectedRequiredTotal(null);
        return;
      }

      setSelectedRequiredTotal(requiredTotalFromText(item.textContent));
    }

    document.addEventListener("click", captureReservation, true);
    return () => document.removeEventListener("click", captureReservation, true);
  }, [pathname]);

  useEffect(() => {
    if (!pathname.startsWith("/dunnes")) {
      setReservationTarget(null);
      setRevealTarget(null);
      return;
    }

    let reservationHost: HTMLDivElement | null = null;
    let hiddenSpend: HTMLElement | null = null;
    let hiddenMembershipNote: HTMLElement | null = null;
    let revealHost: HTMLDivElement | null = null;

    function removeReservationHost() {
      reservationHost?.remove();
      reservationHost = null;
      if (hiddenSpend) hiddenSpend.style.display = "";
      if (hiddenMembershipNote) hiddenMembershipNote.style.display = "";
      hiddenSpend = null;
      hiddenMembershipNote = null;
      setReservationTarget(null);
    }

    function removeRevealHost() {
      revealHost?.remove();
      revealHost = null;
      setRevealTarget(null);
    }

    function syncReservationWarning() {
      const title = document.getElementById("dunnes-reservation-warning-title");
      const dialog = title?.closest("section");
      if (!dialog || selectedRequiredTotal === null) {
        removeReservationHost();
        return;
      }

      if (!reservationHost || !dialog.contains(reservationHost)) {
        removeReservationHost();
        reservationHost = document.createElement("div");
        reservationHost.dataset.membershipRuleHost = "reservation";

        const actions = dialog.lastElementChild;
        dialog.insertBefore(reservationHost, actions ?? null);

        const legacySpend = title.nextElementSibling;
        if (legacySpend instanceof HTMLElement && legacySpend.tagName === "STRONG") {
          hiddenSpend = legacySpend;
          hiddenSpend.style.display = "none";
          const legacyMembershipNote = legacySpend.nextElementSibling;
          if (legacyMembershipNote instanceof HTMLElement && legacyMembershipNote.tagName === "P") {
            hiddenMembershipNote = legacyMembershipNote;
            hiddenMembershipNote.style.display = "none";
          }
        }
      }

      const host = reservationHost;
      if (host) {
        setReservationTarget((current) => current?.element === host && current.requiredTotal === selectedRequiredTotal
          ? current
          : { element: host, requiredTotal: selectedRequiredTotal });
      }
    }

    function syncRevealWarning() {
      const reveal = document.querySelector(".dunnes-reserved article .dunnes-reveal");
      const article = reveal?.closest("article");
      const membershipRequired = article?.querySelector(".dunnes-membership-badge.required");
      const requiredTotal = membershipRequired ? requiredTotalFromText(article?.textContent) : null;

      if (!reveal || requiredTotal === null) {
        removeRevealHost();
        return;
      }

      if (!revealHost || !reveal.contains(revealHost)) {
        removeRevealHost();
        revealHost = document.createElement("div");
        revealHost.dataset.membershipRuleHost = "reveal";
        reveal.prepend(revealHost);
      }

      const host = revealHost;
      if (host) {
        setRevealTarget((current) => current?.element === host && current.requiredTotal === requiredTotal
          ? current
          : { element: host, requiredTotal });
      }
    }

    function sync() {
      syncReservationWarning();
      syncRevealWarning();
    }

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      removeReservationHost();
      removeRevealHost();
    };
  }, [pathname, selectedRequiredTotal]);

  return (
    <>
      {reservationTarget && createPortal(
        <WarningBanner requiredTotal={reservationTarget.requiredTotal} language={language} />,
        reservationTarget.element,
      )}
      {revealTarget && createPortal(
        <WarningBanner requiredTotal={revealTarget.requiredTotal} language={language} sticky />,
        revealTarget.element,
      )}
    </>
  );
}

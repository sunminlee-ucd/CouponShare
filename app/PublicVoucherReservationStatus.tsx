"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { type AppLanguage, useLanguage } from "./i18n";

const COPY: Record<AppLanguage, { badge: string; button: string; aria: string }> = {
  ko: { badge: "예약 중", button: "예약 중", aria: "다른 사용자가 예약 중인 바우처" },
  en: { badge: "Reserved", button: "Reserved", aria: "Voucher reserved by another user" },
  fa: { badge: "رزرو شده", button: "رزرو شده", aria: "ووچر توسط کاربر دیگری رزرو شده است" },
  ja: { badge: "予約中", button: "予約中", aria: "他のユーザーが予約中のバウチャー" },
};

export default function PublicVoucherReservationStatus() {
  const pathname = usePathname();
  const { language } = useLanguage();

  useEffect(() => {
    if (!pathname.startsWith("/dunnes")) return;
    const copy = COPY[language];

    function sync() {
      const busyItems = document.querySelectorAll<HTMLElement>(".dunnes-list-item.busy");
      busyItems.forEach((item) => {
        item.dataset.reservationState = "reserved";
        item.setAttribute("aria-label", copy.aria);

        const detail = item.querySelector<HTMLElement>(":scope > div");
        if (detail && !detail.querySelector("[data-public-reservation-badge]")) {
          const badge = document.createElement("span");
          badge.className = "public-reservation-badge";
          badge.dataset.publicReservationBadge = "true";
          detail.prepend(badge);
        }

        const badge = detail?.querySelector<HTMLElement>("[data-public-reservation-badge]");
        if (badge) badge.textContent = copy.badge;

        const button = item.querySelector<HTMLButtonElement>(":scope > button");
        if (button) {
          button.textContent = copy.button;
          button.disabled = true;
          button.setAttribute("aria-label", copy.aria);
        }
      });
    }

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [language, pathname]);

  return null;
}

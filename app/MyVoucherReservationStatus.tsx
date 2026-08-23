"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { type AppLanguage, useLanguage } from "./i18n";

type Voucher = {
  id: string;
  voucher_type: "5off25" | "10off40" | "10off50";
  expires_on: string;
  status: "available" | "reserved" | "used" | "expired" | "rejected";
  review_status: "pending" | "approved" | "rejected";
  is_mine: boolean;
  reserved_by_me: boolean;
  reserved_until: string | null;
};

const DEVICE_KEY_STORAGE_KEY = "couponshare-device-key-v2";
const REFRESH_INTERVAL_MS = 10_000;

const COPY: Record<AppLanguage, { title: string; body: string; reserved: string; until: string; expiry: string }> = {
  ko: {
    title: "내가 등록한 바우처가 예약 중입니다",
    body: "다른 사용자가 현재 사용을 준비하고 있습니다. 예약이 끝나면 상태가 자동으로 갱신됩니다.",
    reserved: "예약 중 · 다른 사용자가 사용 준비 중",
    until: "예약 만료",
    expiry: "쿠폰 만료",
  },
  en: {
    title: "One of your vouchers is reserved",
    body: "Another user is preparing to use it. The status updates automatically when the reservation ends.",
    reserved: "Reserved · another user is preparing to use it",
    until: "Reservation ends",
    expiry: "Voucher expires",
  },
  fa: {
    title: "یکی از ووچرهای شما رزرو شده است",
    body: "کاربر دیگری در حال آماده‌شدن برای استفاده از آن است. پس از پایان رزرو، وضعیت خودکار به‌روزرسانی می‌شود.",
    reserved: "رزرو شده · کاربر دیگری در حال آماده‌شدن برای استفاده است",
    until: "پایان رزرو",
    expiry: "انقضای ووچر",
  },
  ja: {
    title: "登録したバウチャーが予約されています",
    body: "別のユーザーが現在利用の準備をしています。予約終了後、状態は自動更新されます。",
    reserved: "予約中 · 別のユーザーが利用準備中",
    until: "予約終了",
    expiry: "バウチャー期限",
  },
};

function voucherLabel(type: Voucher["voucher_type"]) {
  if (type === "5off25") return "€5 OFF €25";
  if (type === "10off40") return "€10 OFF €40";
  return "€10 OFF €50";
}

export default function MyVoucherReservationStatus() {
  const pathname = usePathname();
  const { language } = useLanguage();
  const copy = COPY[language];
  const [target, setTarget] = useState<Element | null>(null);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);

  useEffect(() => {
    if (pathname !== "/dunnes") {
      setTarget(null);
      return;
    }
    const shell = document.querySelector(".dunnes-shell");
    const hero = document.querySelector(".dunnes-hero");
    if (!shell || !hero) return;
    const host = document.createElement("div");
    host.dataset.myVoucherReservationStatus = "true";
    hero.insertAdjacentElement("afterend", host);
    setTarget(host);
    return () => host.remove();
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/dunnes") return;
    let disposed = false;
    let controller: AbortController | null = null;

    async function refresh() {
      controller?.abort();
      controller = new AbortController();
      const deviceKey = localStorage.getItem(DEVICE_KEY_STORAGE_KEY) ?? "";
      try {
        const response = await fetch(`/api/dunnes-vouchers?deviceKey=${encodeURIComponent(deviceKey)}`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const result = await response.json() as { vouchers?: Voucher[] };
        if (disposed || controller.signal.aborted) return;
        setVouchers((result.vouchers ?? []).filter((voucher) => voucher.is_mine && voucher.status === "reserved" && !voucher.reserved_by_me));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, REFRESH_INTERVAL_MS);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);

    return () => {
      disposed = true;
      controller?.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [pathname]);

  if (!target || vouchers.length === 0) return null;

  return createPortal(
    <section className="owner-reservation-status" role="status" aria-live="polite">
      <header>
        <span aria-hidden="true">●</span>
        <div><strong>{copy.title}</strong><small>{copy.body}</small></div>
      </header>
      <div className="owner-reservation-list">
        {vouchers.map((voucher) => (
          <article key={voucher.id}>
            <div><strong>{voucherLabel(voucher.voucher_type)}</strong><span>{copy.reserved}</span></div>
            <small>{copy.until}: {voucher.reserved_until ?? "--"} · {copy.expiry}: {voucher.expires_on}</small>
          </article>
        ))}
      </div>
    </section>,
    target,
  );
}

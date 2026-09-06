"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useLanguage } from "./i18n";

type UsedVoucher = {
  voucher_id: string;
  voucher_type: "5off25" | "10off40" | "10off50";
  membership_required: boolean;
  used_at: string;
};

type Payload = { usedToday?: number; vouchers?: UsedVoucher[] };

function voucherLabel(type: UsedVoucher["voucher_type"]) {
  if (type === "5off25") return "€5 OFF €25";
  return type === "10off50" ? "€10 OFF €50" : "€10 OFF €40";
}

export default function TodayUsedVouchersPanel() {
  const pathname = usePathname();
  const { language } = useLanguage();
  const [usedToday, setUsedToday] = useState(0);
  const [vouchers, setVouchers] = useState<UsedVoucher[]>([]);

  useEffect(() => {
    if (!pathname.startsWith("/dunnes")) return;
    let disposed = false;

    async function refresh() {
      try {
        const response = await fetch("/api/dunnes-used-today", { cache: "no-store", credentials: "same-origin" });
        if (!response.ok) return;
        const payload = await response.json() as Payload;
        if (disposed) return;
        setUsedToday(Number(payload.usedToday ?? 0));
        setVouchers(payload.vouchers ?? []);
      } catch {
        // Live activity is supplemental and should never block voucher use.
      }
    }

    void refresh();
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [pathname]);

  if (!pathname.startsWith("/dunnes")) return null;

  const copy = language === "en" ? {
    eyebrow: "LIVE TODAY",
    title: "Vouchers used today",
    empty: "Waiting for today's first completed voucher.",
    used: "Used",
    membership: "ValueClub",
  } : language === "fa" ? {
    eyebrow: "امروز · زنده",
    title: "ووچرهای استفاده‌شده امروز",
    empty: "منتظر اولین ووچر استفاده‌شده امروز هستیم.",
    used: "استفاده شد",
    membership: "ValueClub",
  } : language === "ja" ? {
    eyebrow: "TODAY · LIVE",
    title: "本日使用済みのバウチャー",
    empty: "本日最初の使用完了を待っています。",
    used: "使用済み",
    membership: "ValueClub",
  } : {
    eyebrow: "TODAY · LIVE",
    title: "오늘 사용완료된 바우처",
    empty: "오늘 첫 사용완료 바우처를 기다리고 있습니다.",
    used: "사용완료",
    membership: "ValueClub",
  };

  return (
    <aside className="today-used-panel" aria-label={copy.title}>
      <header>
        <div>
          <span className="today-used-live"><i aria-hidden="true" />{copy.eyebrow}</span>
          <strong>{copy.title}</strong>
        </div>
        <b>{usedToday}</b>
      </header>
      {vouchers.length ? (
        <div className="today-used-list">
          {vouchers.slice(0, 5).map((voucher) => (
            <div className="today-used-item" key={voucher.voucher_id}>
              <div>
                <strong>{voucherLabel(voucher.voucher_type)}</strong>
                <span>{voucher.membership_required ? `${copy.membership} · ` : ""}{voucher.used_at}</span>
              </div>
              <span className="today-used-status">{copy.used}</span>
            </div>
          ))}
        </div>
      ) : <p>{copy.empty}</p>}
    </aside>
  );
}

"use client";

import { useEffect, useState } from "react";
import { type AppLanguage, useLanguage } from "./i18n";

type OwnerNotification = {
  id: string;
  voucher_id: string;
  voucher_label: string;
  membership_required: boolean;
  created_at: string;
};

type Copy = {
  eyebrow: string;
  title: string;
  body: string;
  membership: string;
  used: string;
  released: string;
  saving: string;
  error: string;
};

const COPY: Record<AppLanguage, Copy> = {
  ko: {
    eyebrow: "개인 알림",
    title: "바우처가 실제로 사용되었는지 확인해 주세요",
    body: "예약한 사용자가 이 바우처를 사용완료로 표시했습니다. 실제로 사용된 것이 맞는지 확인한 뒤 상태를 선택해 주세요.",
    membership: "ValueClub Card가 함께 등록된 바우처입니다.",
    used: "사용완료 처리",
    released: "계속 쿠폰 공유",
    saving: "처리 중…",
    error: "알림을 처리하지 못했습니다. 다시 시도해 주세요.",
  },
  en: {
    eyebrow: "PRIVATE NOTICE",
    title: "Please confirm whether your voucher was actually used",
    body: "The person who reserved this voucher marked it as used. Please confirm the real status before the voucher is removed or shared again.",
    membership: "This voucher was uploaded with a ValueClub Card scan.",
    used: "Mark as used",
    released: "Keep sharing",
    saving: "Saving…",
    error: "Could not update this notification. Please try again.",
  },
  fa: {
    eyebrow: "اعلان خصوصی",
    title: "لطفاً تأیید کنید که ووچر واقعاً استفاده شده است",
    body: "کاربری که این ووچر را رزرو کرده بود آن را استفاده‌شده اعلام کرده است. لطفاً وضعیت واقعی را بررسی و انتخاب کنید.",
    membership: "این ووچر همراه با اسکن ValueClub Card ثبت شده است.",
    used: "ثبت به‌عنوان استفاده‌شده",
    released: "ادامه اشتراک ووچر",
    saving: "در حال ذخیره…",
    error: "به‌روزرسانی اعلان انجام نشد. دوباره تلاش کنید.",
  },
  ja: {
    eyebrow: "個人通知",
    title: "バウチャーが実際に使用されたか確認してください",
    body: "予約したユーザーがこのバウチャーを使用済みとして報告しました。実際の状態を確認して選択してください。",
    membership: "このバウチャーにはValueClub Cardのスキャンも登録されています。",
    used: "使用済みにする",
    released: "共有を続ける",
    saving: "保存中…",
    error: "通知を更新できませんでした。もう一度お試しください。",
  },
};

const POLL_MS = 15_000;
const ACTIVE_SCAN_SELECTOR = '[data-dunnes-barcode-overlay="true"]';

export default function OwnerVoucherNotification() {
  const { language } = useLanguage();
  const [pending, setPending] = useState<OwnerNotification | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const copy = COPY[language];

  useEffect(() => {
    let disposed = false;

    async function refresh() {
      if (document.querySelector(ACTIVE_SCAN_SELECTOR)) return;
      try {
        const response = await fetch("/api/notifications", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) {
          if (!disposed && (response.status === 401 || response.status === 404)) setPending(null);
          return;
        }
        const result = await response.json() as { notifications?: OwnerNotification[] };
        if (!disposed) setPending(result.notifications?.[0] ?? null);
      } catch {
        // Retry on the next poll without interrupting the current page.
      }
    }

    void refresh();
    const interval = window.setInterval(() => void refresh(), POLL_MS);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [refreshKey]);

  async function resolve(resolution: "released" | "used") {
    if (!pending || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notificationId: pending.id, resolution }),
      });
      if (!response.ok) throw new Error("save_failed");
      setPending(null);
      setRefreshKey((value) => value + 1);
    } catch {
      setError(copy.error);
    } finally {
      setSaving(false);
    }
  }

  if (!pending) return null;

  return (
    <div className="owner-voucher-notification-backdrop" role="presentation">
      <section className="owner-voucher-notification-dialog" role="alertdialog" aria-modal="true" aria-labelledby="owner-voucher-notification-title">
        <p className="owner-voucher-notification-eyebrow">{copy.eyebrow}</p>
        <h2 id="owner-voucher-notification-title">{copy.title}</h2>
        <strong className="owner-voucher-notification-label">{pending.voucher_label}</strong>
        <p>{copy.body}</p>
        {pending.membership_required && <p className="owner-voucher-notification-membership">{copy.membership}</p>}
        {error && <p className="owner-voucher-notification-error" role="alert">{error}</p>}
        <div className="owner-voucher-notification-actions">
          <button type="button" className="owner-voucher-notification-release" disabled={saving} onClick={() => void resolve("released")}>{saving ? copy.saving : copy.released}</button>
          <button type="button" className="owner-voucher-notification-used" disabled={saving} onClick={() => void resolve("used")}>{saving ? copy.saving : copy.used}</button>
        </div>
      </section>
    </div>
  );
}

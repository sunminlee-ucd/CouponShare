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
    eyebrow: "바우처 상태 확인",
    title: "이 바우처를 다시 공유할지 확인해 주세요",
    body: "예약한 사용자가 이 바우처를 사용하지 않았다고 표시했습니다. 실제로 사용되지 않은 것이 맞다면 계속 공유하고, 이미 사용됐다면 사용완료로 처리해 주세요.",
    membership: "ValueClub Card가 함께 등록된 바우처입니다.",
    used: "사용완료 처리",
    released: "계속 쿠폰 공유",
    saving: "처리 중…",
    error: "상태를 처리하지 못했습니다. 다시 시도해 주세요.",
  },
  en: {
    eyebrow: "VOUCHER STATUS",
    title: "Please decide whether to share this voucher again",
    body: "The person who reserved this voucher said they did not use it. If that is correct, keep sharing it. If it was already used, mark it as used.",
    membership: "This voucher was uploaded with a ValueClub Card scan.",
    used: "Mark as used",
    released: "Keep sharing",
    saving: "Saving…",
    error: "Could not update this voucher. Please try again.",
  },
  fa: {
    eyebrow: "وضعیت ووچر",
    title: "لطفاً مشخص کنید ووچر دوباره به اشتراک گذاشته شود یا نه",
    body: "کاربری که ووچر را رزرو کرده بود اعلام کرده که از آن استفاده نکرده است. اگر درست است، اشتراک‌گذاری را ادامه دهید؛ اگر ووچر استفاده شده، آن را استفاده‌شده ثبت کنید.",
    membership: "این ووچر همراه با اسکن ValueClub Card ثبت شده است.",
    used: "ثبت به‌عنوان استفاده‌شده",
    released: "ادامه اشتراک ووچر",
    saving: "در حال ذخیره…",
    error: "به‌روزرسانی وضعیت انجام نشد. دوباره تلاش کنید.",
  },
  ja: {
    eyebrow: "バウチャー状態",
    title: "このバウチャーを再び共有するか確認してください",
    body: "予約したユーザーが、このバウチャーを使用しなかったと申告しました。未使用であれば共有を続け、すでに使用済みなら使用済みにしてください。",
    membership: "このバウチャーにはValueClub Cardのスキャンも登録されています。",
    used: "使用済みにする",
    released: "共有を続ける",
    saving: "保存中…",
    error: "状態を更新できませんでした。もう一度お試しください。",
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
        const response = await fetch("/api/notifications/owner-review", {
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
      const response = await fetch("/api/notifications/owner-review", {
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

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
  later: string;
  used: string;
  released: string;
  saving: string;
  error: string;
};

const COPY: Record<AppLanguage, Copy> = {
  ko: {
    eyebrow: "\uAC1C\uC778 \uC54C\uB9BC",
    title: "\uB0B4 \uBC14\uC6B0\uCC98 \uC0C1\uD0DC\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694",
    body: "\uC608\uC57D\uD55C \uC0AC\uC6A9\uC790\uAC00 \uC774 \uBC14\uC6B0\uCC98\uB97C \uC0AC\uC6A9\uD558\uC9C0 \uC54A\uC558\uB2E4\uACE0 \uD45C\uC2DC\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uB098\uB214\uD558\uAE30 \uC804\uC5D0 \uC815\uB9D0 \uBBF8\uC0AC\uC6A9 \uC0C1\uD0DC\uC778\uC9C0 \uD655\uC778\uD574 \uC8FC\uC138\uC694.",
    membership: "ValueClub Card\uAC00 \uD568\uAED8 \uB4F1\uB85D\uB41C \uBC14\uC6B0\uCC98\uC785\uB2C8\uB2E4.",
    later: "\uB098\uC911\uC5D0 \uD655\uC778",
    used: "\uC774\uBBF8 \uC0AC\uC6A9\uB428",
    released: "\uBBF8\uC0AC\uC6A9 \uD655\uC778 \u00B7 \uB2E4\uC2DC \uB098\uB214",
    saving: "\uCC98\uB9AC \uC911\u2026",
    error: "\uC54C\uB9BC\uC744 \uCC98\uB9AC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.",
  },
  en: {
    eyebrow: "PRIVATE NOTICE",
    title: "Please confirm your voucher status",
    body: "The person who reserved this voucher marked it as not used. Please confirm that it is genuinely unused before it is shared again.",
    membership: "This voucher was uploaded with a ValueClub Card scan.",
    later: "Check later",
    used: "Already used",
    released: "Unused · share again",
    saving: "Saving…",
    error: "Could not update this notification. Please try again.",
  },
  fa: {
    eyebrow: "اعلان خصوصی",
    title: "لطفاً وضعیت ووچر خود را تأیید کنید",
    body: "کاربری که این ووچر را رزرو کرده بود اعلام کرده که از آن استفاده نکرده است. پیش از اشتراک‌گذاری دوباره، لطفاً تأیید کنید که واقعاً استفاده نشده است.",
    membership: "این ووچر همراه با اسکن ValueClub Card ثبت شده است.",
    later: "بعداً بررسی می‌کنم",
    used: "قبلاً استفاده شده",
    released: "استفاده نشده · اشتراک دوباره",
    saving: "در حال ذخیره…",
    error: "به‌روزرسانی اعلان انجام نشد. دوباره تلاش کنید.",
  },
  ja: {
    eyebrow: "個人通知",
    title: "バウチャーの状態を確認してください",
    body: "予約したユーザーが、このバウチャーを使用しなかったと報告しました。再共有する前に、本当に未使用か確認してください。",
    membership: "このバウチャーにはValueClub Cardのスキャンも登録されています。",
    later: "あとで確認",
    used: "すでに使用済み",
    released: "未使用を確認 · 再共有",
    saving: "保存中…",
    error: "通知を更新できませんでした。もう一度お試しください。",
  },
};

const POLL_MS = 15_000;
const ACTIVE_SCAN_SELECTOR = '[data-dunnes-barcode-overlay="true"]';

export default function OwnerVoucherNotification() {
  const { language } = useLanguage();
  const [pending, setPending] = useState<OwnerNotification | null>(null);
  const [snoozedId, setSnoozedId] = useState<string | null>(null);
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
        const next = (result.notifications ?? []).find((item) => item.id !== snoozedId) ?? null;
        if (!disposed) setPending(next);
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
  }, [refreshKey, snoozedId]);

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
      setSnoozedId(null);
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
          <button type="button" className="owner-voucher-notification-later" disabled={saving} onClick={() => { setSnoozedId(pending.id); setPending(null); }}>{copy.later}</button>
          <button type="button" className="owner-voucher-notification-used" disabled={saving} onClick={() => void resolve("used")}>{saving ? copy.saving : copy.used}</button>
          <button type="button" className="owner-voucher-notification-release" disabled={saving} onClick={() => void resolve("released")}>{saving ? copy.saving : copy.released}</button>
        </div>
      </section>
    </div>
  );
}

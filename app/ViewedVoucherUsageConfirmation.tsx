"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { type AppLanguage, useLanguage } from "./i18n";

type PendingVoucher = {
  voucher_id: string;
  voucher_label: string;
  membership_required: boolean;
  locked_at: string;
};

type Copy = {
  eyebrow: string;
  title: string;
  body: string;
  membership: string;
  used: string;
  unused: string;
  saving: string;
  error: string;
};

const COPY: Record<AppLanguage, Copy> = {
  ko: {
    eyebrow: "사용 여부 확인",
    title: "이 바우처를 실제로 사용하셨나요?",
    body: "바우처를 한 번 열어본 뒤에는 다른 사용자에게 자동으로 다시 공개하지 않습니다. 정확한 상태를 선택해 주세요.",
    membership: "ValueClub Card를 함께 확인한 바우처입니다.",
    used: "사용했어요",
    unused: "사용하지 않았어요",
    saving: "처리 중…",
    error: "상태를 저장하지 못했습니다. 다시 시도해 주세요.",
  },
  en: {
    eyebrow: "USAGE CHECK",
    title: "Did you actually use this voucher?",
    body: "Once a voucher has been opened, it will not be released to other users automatically. Please confirm its actual status.",
    membership: "This voucher also included a ValueClub Card scan.",
    used: "I used it",
    unused: "I did not use it",
    saving: "Saving…",
    error: "Could not save the status. Please try again.",
  },
  fa: {
    eyebrow: "تأیید استفاده",
    title: "آیا واقعاً از این ووچر استفاده کردید؟",
    body: "پس از باز شدن ووچر، به‌صورت خودکار دوباره برای دیگران آزاد نمی‌شود. لطفاً وضعیت واقعی را مشخص کنید.",
    membership: "این ووچر شامل اسکن ValueClub Card نیز بوده است.",
    used: "استفاده کردم",
    unused: "استفاده نکردم",
    saving: "در حال ذخیره…",
    error: "ذخیره وضعیت انجام نشد. دوباره تلاش کنید.",
  },
  ja: {
    eyebrow: "利用確認",
    title: "このバウチャーを実際に使用しましたか？",
    body: "一度開いたバウチャーは、他の利用者へ自動的に再公開されません。実際の状態を選択してください。",
    membership: "このバウチャーではValueClub Cardも確認されています。",
    used: "使用しました",
    unused: "使用していません",
    saving: "保存中…",
    error: "状態を保存できませんでした。もう一度お試しください。",
  },
};

const POLL_MS = 10_000;
const ACTIVE_SCAN_SELECTOR = '[data-dunnes-barcode-overlay="true"]';

export default function ViewedVoucherUsageConfirmation() {
  const pathname = usePathname();
  const { language } = useLanguage();
  const [pending, setPending] = useState<PendingVoucher | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lockedImages = useRef(new Set<string>());
  const copy = COPY[language];

  useEffect(() => {
    if (!pathname.startsWith("/dunnes")) {
      setPending(null);
      return;
    }

    let disposed = false;

    async function refreshPending() {
      if (document.querySelector(ACTIVE_SCAN_SELECTOR)) {
        if (!disposed) setPending(null);
        return;
      }
      try {
        const response = await fetch("/api/dunnes-view-lock", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) return;
        const result = await response.json() as { pending?: PendingVoucher[] };
        if (!disposed) setPending(result.pending?.[0] ?? null);
      } catch {
        // Keep the current state and retry on the next poll.
      }
    }

    async function lockImage(image: HTMLImageElement) {
      const imageData = image.src;
      if (!imageData.startsWith("data:image/") || lockedImages.current.has(imageData)) return;
      lockedImages.current.add(imageData);
      try {
        await fetch("/api/dunnes-view-lock", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ imageData }),
        });
      } catch {
        lockedImages.current.delete(imageData);
      }
    }

    function scanRevealedImages() {
      document.querySelectorAll<HTMLImageElement>(".dunnes-reveal img").forEach((image) => void lockImage(image));
      if (document.querySelector(ACTIVE_SCAN_SELECTOR)) setPending(null);
    }

    scanRevealedImages();
    void refreshPending();
    const observer = new MutationObserver(scanRevealedImages);
    observer.observe(document.body, { childList: true, subtree: true });
    const interval = window.setInterval(() => void refreshPending(), POLL_MS);

    return () => {
      disposed = true;
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, [pathname]);

  async function resolve(used: boolean) {
    if (!pending || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/dunnes-vouchers", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: used ? "mark_used" : "cancel_reservation", voucherId: pending.voucher_id }),
      });
      if (!response.ok) throw new Error("save_failed");
      setPending(null);
      window.location.reload();
    } catch {
      setError(copy.error);
      setSaving(false);
    }
  }

  if (!pending) return null;

  return (
    <div className="viewed-voucher-confirm-backdrop" role="presentation">
      <section className="viewed-voucher-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="viewed-voucher-confirm-title">
        <p className="viewed-voucher-confirm-eyebrow">{copy.eyebrow}</p>
        <h2 id="viewed-voucher-confirm-title">{copy.title}</h2>
        <strong>{pending.voucher_label}</strong>
        <p>{copy.body}</p>
        {pending.membership_required && <p className="viewed-voucher-confirm-membership">{copy.membership}</p>}
        {error && <p className="viewed-voucher-confirm-error" role="alert">{error}</p>}
        <div className="viewed-voucher-confirm-actions">
          <button type="button" disabled={saving} onClick={() => void resolve(false)}>{saving ? copy.saving : copy.unused}</button>
          <button type="button" disabled={saving} onClick={() => void resolve(true)}>{saving ? copy.saving : copy.used}</button>
        </div>
      </section>
    </div>
  );
}

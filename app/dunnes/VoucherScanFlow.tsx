"use client";

import { useState } from "react";
import VoucherBarcodeDisplay from "./VoucherBarcodeDisplay";
import enhancerStyles from "./DunnesBarcodeEnhancer.module.css";
import styles from "./VoucherScanFlow.module.css";

type AppLanguage = "ko" | "en" | "fa";

type Props = {
  imageData: string;
  label: string;
  language: AppLanguage;
};

export default function VoucherScanFlow({ imageData, label, language }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = language === "en" ? {
    title: "Voucher scan",
    note: "Open the original voucher instantly and scan it at checkout.",
    warning: "Tap the voucher to enlarge it. Tap the enlarged image again for a closer lossless view.",
    scanned: "Scanned · close",
    confirmTitle: "Have you finished using this voucher?",
    confirmBody: "Choose Yes only after the checkout scanner has accepted the discount voucher.",
    yes: "Yes · mark as used",
    no: "No · scan again",
    completing: "Saving…",
    error: "Could not mark this voucher as used. Please try again.",
  } : language === "fa" ? {
    title: "اسکن ووچر",
    note: "تصویر اصلی ووچر را فوری باز کنید و در صندوق اسکن کنید.",
    warning: "روی ووچر بزنید تا بزرگ شود. برای نمای نزدیک‌تر بدون افت کیفیت دوباره روی تصویر بزنید.",
    scanned: "اسکن شد · بستن",
    confirmTitle: "آیا استفاده از این ووچر واقعاً تمام شده است؟",
    confirmBody: "فقط زمانی «بله» را بزنید که اسکنر صندوق ووچر تخفیف را پذیرفته باشد.",
    yes: "بله · استفاده شد",
    no: "خیر · دوباره اسکن",
    completing: "در حال ذخیره…",
    error: "ثبت استفاده از ووچر انجام نشد. دوباره تلاش کنید.",
  } : {
    title: "쿠폰 확대 스캔",
    note: "원본 쿠폰을 바로 열어 계산대에서 스캔하세요.",
    warning: "쿠폰을 누르면 크게 열립니다. 확대 화면을 한 번 더 누르면 원본 화질 범위에서 더 크게 볼 수 있습니다.",
    scanned: "스캔 완료 · 닫기",
    confirmTitle: "정말 사용 완료하셨습니까?",
    confirmBody: "계산대에서 할인 쿠폰 스캔이 정상적으로 완료된 경우에만 예를 눌러 주세요.",
    yes: "예 · 사용 완료",
    no: "아니오 · 다시 스캔",
    completing: "사용 완료 처리 중…",
    error: "사용 완료 처리하지 못했습니다. 다시 시도해 주세요.",
  };

  async function completeVoucher() {
    if (completing) return;
    setCompleting(true);
    setError(null);
    try {
      const response = await fetch("/api/dunnes-complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageData }),
      });
      if (!response.ok) throw new Error("completion failed");
      window.location.reload();
    } catch {
      setError(copy.error);
      setCompleting(false);
    }
  }

  return (
    <section className={enhancerStyles.dialog} role="dialog" aria-modal="true" aria-label={`${label} voucher scan`}>
      <header className={enhancerStyles.header}>
        <div><strong>{copy.title}</strong><span>{copy.note}</span></div>
        {!confirming && <button type="button" className="secondary" onClick={() => { setError(null); setConfirming(true); }}>{copy.scanned}</button>}
      </header>

      {confirming ? (
        <div className={styles.confirmation} role="alertdialog" aria-labelledby="dunnes-use-confirm-title" aria-describedby="dunnes-use-confirm-body">
          <div className={styles.confirmIcon} aria-hidden="true">?</div>
          <h2 id="dunnes-use-confirm-title">{copy.confirmTitle}</h2>
          <p id="dunnes-use-confirm-body">{copy.confirmBody}</p>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.actions}>
            <button type="button" className="secondary" disabled={completing} onClick={() => { setError(null); setConfirming(false); }}>{copy.no}</button>
            <button type="button" disabled={completing} onClick={() => void completeVoucher()}>{completing ? copy.completing : copy.yes}</button>
          </div>
        </div>
      ) : (
        <>
          <p className={enhancerStyles.warning} role="note">{copy.warning}</p>
          <VoucherBarcodeDisplay imageData={imageData} label={label} language={language} />
        </>
      )}
    </section>
  );
}

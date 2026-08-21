"use client";
/* eslint-disable @next/next/no-img-element -- voucher images are private data URLs */

import { useEffect, useState } from "react";
import styles from "./VoucherBarcodeDisplay.module.css";

type AppLanguage = "ko" | "en" | "fa" | "ja";
type Props = {
  imageData: string;
  barcode?: string | null;
  label: string;
  language?: AppLanguage;
};

export default function VoucherBarcodeDisplay({ imageData, barcode, label, language = "ko" }: Props) {
  const [resolvedBarcode, setResolvedBarcode] = useState<string | null>(barcode ?? null);
  const copy = language === "en" ? {
    hint: "Tap the voucher to enlarge it, turn up your screen brightness, and hold the barcode flat toward the checkout scanner.",
    tap: "Tap voucher to enlarge for scanning",
  } : language === "fa" ? {
    hint: "برای اسکن، روی ووچر بزنید تا بزرگ شود، روشنایی صفحه را زیاد کنید و بارکد را صاف روبه‌روی اسکنر بگیرید.",
    tap: "برای اسکن، ووچر را لمس و بزرگ کنید",
  } : language === "ja" ? {
    hint: "バウチャーをタップして拡大し、画面の明るさを上げてバーコードをレジのスキャナーに正面から向けてください。",
    tap: "バウチャーをタップして拡大・スキャン",
  } : {
    hint: "쿠폰을 눌러 크게 연 뒤 화면 밝기를 높이고 바코드를 계산대 스캐너 정면에 보여주세요.",
    tap: "쿠폰을 눌러 확대해서 스캔",
  };

  useEffect(() => {
    let cancelled = false;
    setResolvedBarcode(barcode ?? null);
    if (barcode) return () => { cancelled = true; };

    void fetch("/api/dunnes-barcode", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ imageData }),
    }).then(async (response) => {
      if (!response.ok) return;
      const result = await response.json() as { barcode?: string };
      if (!cancelled && typeof result.barcode === "string") setResolvedBarcode(result.barcode);
    }).catch(() => undefined);

    return () => { cancelled = true; };
  }, [barcode, imageData]);

  return (
    <div className={styles.shell} dir={language === "fa" ? "rtl" : undefined}>
      <div className={styles.scanPanel}>
        <strong>{label}</strong>
        <span className={styles.scanHint}>{copy.hint}</span>
        <button
          className={styles.voucherImageFrame}
          type="button"
          data-dunnes-original-voucher-trigger="true"
          aria-label={copy.tap}
        >
          <img
            className={styles.voucherImage}
            src={imageData}
            alt={`${label} full voucher`}
            draggable={false}
          />
          <span className={styles.zoomPrompt}>{copy.tap}</span>
        </button>
        {resolvedBarcode && <code className={styles.barcodeNumber} dir="ltr">{resolvedBarcode}</code>}
      </div>
    </div>
  );
}

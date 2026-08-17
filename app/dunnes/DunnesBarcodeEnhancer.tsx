"use client";

import { useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import VoucherBarcodeDisplay from "./VoucherBarcodeDisplay";
import styles from "./DunnesBarcodeEnhancer.module.css";

type AppLanguage = "ko" | "en" | "fa";
type MountedOverlay = {
  host: HTMLDivElement;
  root: Root;
  imageData: string;
};

const LANGUAGE_STORAGE_KEY = "couponshare-language-v1";

function currentLanguage(): AppLanguage {
  const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return saved === "en" || saved === "fa" ? saved : "ko";
}

export default function DunnesBarcodeEnhancer() {
  useEffect(() => {
    let mounted: MountedOverlay | null = null;
    let dismissedImageData: string | null = null;

    const destroy = () => {
      if (!mounted) return;
      const current = mounted;
      mounted = null;
      current.root.unmount();
      current.host.remove();
    };

    const closeCurrent = () => {
      if (mounted) dismissedImageData = mounted.imageData;
      queueMicrotask(destroy);
    };

    const show = (image: HTMLImageElement) => {
      const imageData = image.src;
      if (!imageData || dismissedImageData === imageData) return;
      if (mounted?.imageData === imageData) return;
      destroy();

      const language = currentLanguage();
      const copy = language === "en" ? {
        title: "Enlarged barcode",
        note: "Close this after the voucher has been scanned.",
        close: "Scanned · close",
      } : language === "fa" ? {
        title: "نمایش بزرگ بارکد",
        note: "پس از اسکن ووچر این صفحه را ببندید.",
        close: "اسکن شد · بستن",
      } : {
        title: "바코드 크게 보기",
        note: "바우처 스캔이 끝나면 닫아 주세요.",
        close: "스캔 완료 · 닫기",
      };

      const host = document.createElement("div");
      host.dataset.dunnesBarcodeOverlay = "true";
      document.body.appendChild(host);
      const root = createRoot(host);
      const label = image.alt.replace(/\s+voucher$/i, "").trim() || "Dunnes voucher";
      root.render(
        <div className={styles.backdrop} role="presentation" dir={language === "fa" ? "rtl" : undefined}>
          <section className={styles.dialog} role="dialog" aria-modal="true" aria-label={`${label} barcode`}>
            <header className={styles.header}>
              <div><strong>{copy.title}</strong><span>{copy.note}</span></div>
              <button type="button" className="secondary" onClick={closeCurrent}>{copy.close}</button>
            </header>
            <VoucherBarcodeDisplay imageData={imageData} label={label} language={language} />
          </section>
        </div>,
      );
      mounted = { host, root, imageData };
    };

    const sync = () => {
      const voucherImage = document.querySelector<HTMLImageElement>('.dunnes-reveal img[alt$=" voucher"]');
      if (!voucherImage) {
        dismissedImageData = null;
        destroy();
        return;
      }
      show(voucherImage);
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      destroy();
    };
  }, []);

  return null;
}

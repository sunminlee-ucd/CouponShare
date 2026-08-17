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
const ORIGINAL_IMAGE_SELECTOR = 'img[alt$=" full voucher"], img[alt$=" voucher fallback"]';

function currentLanguage(): AppLanguage {
  const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return saved === "en" || saved === "fa" ? saved : "ko";
}

export default function DunnesBarcodeEnhancer() {
  useEffect(() => {
    let mounted: MountedOverlay | null = null;
    let dismissedImageData: string | null = null;
    let originalLightbox: HTMLDivElement | null = null;

    const destroyOriginalLightbox = () => {
      originalLightbox?.remove();
      originalLightbox = null;
    };

    const showOriginalLightbox = (image: HTMLImageElement) => {
      if (!image.src) return;
      destroyOriginalLightbox();

      const backdrop = document.createElement("div");
      backdrop.className = styles.originalBackdrop;
      backdrop.setAttribute("role", "presentation");
      backdrop.dataset.dunnesOriginalVoucher = "true";

      const frame = document.createElement("div");
      frame.className = styles.originalFrame;
      frame.setAttribute("role", "dialog");
      frame.setAttribute("aria-modal", "true");
      frame.setAttribute("aria-label", "Original voucher image");

      const closeButton = document.createElement("button");
      closeButton.type = "button";
      closeButton.className = styles.originalClose;
      closeButton.setAttribute("aria-label", "Close original voucher");
      closeButton.textContent = "×";

      const fullImage = document.createElement("img");
      fullImage.className = styles.originalImage;
      fullImage.src = image.src;
      fullImage.alt = image.alt || "Original Dunnes voucher";
      fullImage.draggable = false;

      closeButton.addEventListener("click", destroyOriginalLightbox);
      frame.addEventListener("click", (event) => event.stopPropagation());
      backdrop.addEventListener("click", destroyOriginalLightbox);
      frame.append(closeButton, fullImage);
      backdrop.appendChild(frame);
      document.body.appendChild(backdrop);
      originalLightbox = backdrop;
    };

    const destroy = () => {
      destroyOriginalLightbox();
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

    const handleOriginalImageClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLImageElement) || !target.matches(ORIGINAL_IMAGE_SELECTOR)) return;
      event.preventDefault();
      event.stopPropagation();
      showOriginalLightbox(target);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && originalLightbox) destroyOriginalLightbox();
    };

    document.addEventListener("click", handleOriginalImageClick);
    document.addEventListener("keydown", handleKeyDown);
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      document.removeEventListener("click", handleOriginalImageClick);
      document.removeEventListener("keydown", handleKeyDown);
      observer.disconnect();
      destroy();
    };
  }, []);

  return null;
}

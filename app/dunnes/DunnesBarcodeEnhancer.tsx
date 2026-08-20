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
const ORIGINAL_IMAGE_SELECTOR = 'img[alt$=" full voucher"]';
const ORIGINAL_IMAGE_TRIGGER_SELECTOR = '[data-dunnes-original-voucher-trigger="true"]';

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
      fullImage.tabIndex = 0;
      fullImage.setAttribute("role", "button");
      fullImage.setAttribute("aria-label", "Tap to toggle full-resolution zoom");

      let zoomed = false;
      const toggleZoom = () => {
        if (!fullImage.naturalWidth) return;
        zoomed = !zoomed;
        if (!zoomed) {
          fullImage.classList.remove(styles.originalImageZoomed);
          fullImage.style.width = "";
          fullImage.style.maxWidth = "";
          fullImage.style.maxHeight = "";
          return;
        }

        const fittedWidth = Math.max(1, frame.clientWidth - 20);
        const targetWidth = Math.min(fullImage.naturalWidth, Math.round(fittedWidth * 1.75));
        fullImage.classList.add(styles.originalImageZoomed);
        fullImage.style.width = `${targetWidth}px`;
        fullImage.style.maxWidth = "none";
        fullImage.style.maxHeight = "none";
        requestAnimationFrame(() => {
          frame.scrollLeft = Math.max(0, (fullImage.scrollWidth - frame.clientWidth) / 2);
        });
      };

      closeButton.addEventListener("click", destroyOriginalLightbox);
      fullImage.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleZoom();
      });
      fullImage.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleZoom();
        }
      });
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
        title: "Voucher scan",
        note: "Open the original voucher instantly and scan it at checkout.",
        warning: "Tap the voucher to enlarge it. Tap the enlarged image again for a closer lossless view.",
        close: "Scanned · close",
      } : language === "fa" ? {
        title: "اسکن ووچر",
        note: "تصویر اصلی ووچر را فوری باز کنید و در صندوق اسکن کنید.",
        warning: "روی ووچر بزنید تا بزرگ شود. برای نمای نزدیک‌تر بدون افت کیفیت دوباره روی تصویر بزنید.",
        close: "اسکن شد · بستن",
      } : {
        title: "쿠폰 확대 스캔",
        note: "원본 쿠폰을 바로 열어 계산대에서 스캔하세요.",
        warning: "쿠폰을 누르면 크게 열립니다. 확대 화면을 한 번 더 누르면 원본 화질 범위에서 더 크게 볼 수 있습니다.",
        close: "스캔 완료 · 닫기",
      };

      const host = document.createElement("div");
      host.dataset.dunnesBarcodeOverlay = "true";
      document.body.appendChild(host);
      const root = createRoot(host);
      const label = image.alt.replace(/\s+voucher$/i, "").trim() || "Dunnes voucher";
      root.render(
        <div className={styles.backdrop} role="presentation" dir={language === "fa" ? "rtl" : undefined}>
          <section className={styles.dialog} role="dialog" aria-modal="true" aria-label={`${label} voucher scan`}>
            <header className={styles.header}>
              <div><strong>{copy.title}</strong><span>{copy.note}</span></div>
              <button type="button" className="secondary" onClick={closeCurrent}>{copy.close}</button>
            </header>
            <p className={styles.warning} role="note">{copy.warning}</p>
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
      if (!(target instanceof Element)) return;
      const directImage = target instanceof HTMLImageElement && target.matches(ORIGINAL_IMAGE_SELECTOR) ? target : null;
      const trigger = target.closest<HTMLElement>(ORIGINAL_IMAGE_TRIGGER_SELECTOR);
      const image = directImage ?? trigger?.querySelector<HTMLImageElement>(ORIGINAL_IMAGE_SELECTOR) ?? null;
      if (!image) return;
      event.preventDefault();
      event.stopPropagation();
      showOriginalLightbox(image);
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

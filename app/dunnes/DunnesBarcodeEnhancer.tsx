"use client";

import { useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import VoucherScanFlow from "./VoucherScanFlow";
import styles from "./DunnesBarcodeEnhancer.module.css";

type AppLanguage = "ko" | "en" | "fa" | "ja";
type ScanKind = "voucher" | "membership";
type MountedOverlay = {
  host: HTMLDivElement;
  root: Root;
  imageData: string;
};

const LANGUAGE_STORAGE_KEY = "couponshare-language-v1";
const ORIGINAL_IMAGE_SELECTOR = 'img[alt$=" full voucher"]';
const ORIGINAL_IMAGE_TRIGGER_SELECTOR = '[data-dunnes-original-voucher-trigger="true"]';
const LIGHTBOX_CLOSE_EVENT = "couponshare:dunnes-scan-lightbox-close";

function currentLanguage(): AppLanguage {
  const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return saved === "en" || saved === "fa" || saved === "ja" ? saved : "ko";
}

export default function DunnesBarcodeEnhancer() {
  useEffect(() => {
    let mounted: MountedOverlay | null = null;
    let originalLightbox: HTMLDivElement | null = null;
    let originalLightboxKind: ScanKind | null = null;

    const destroyOriginalLightbox = () => {
      originalLightbox?.remove();
      originalLightbox = null;
      originalLightboxKind = null;
    };

    const requestCloseOriginalLightbox = () => {
      const kind = originalLightboxKind;
      destroyOriginalLightbox();
      if (kind) {
        window.dispatchEvent(new CustomEvent(LIGHTBOX_CLOSE_EVENT, { detail: { kind } }));
      }
    };

    const showOriginalLightbox = (image: HTMLImageElement, kind: ScanKind) => {
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

      closeButton.addEventListener("click", requestCloseOriginalLightbox);
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
      backdrop.addEventListener("click", requestCloseOriginalLightbox);
      frame.append(closeButton, fullImage);
      backdrop.appendChild(frame);
      document.body.appendChild(backdrop);
      originalLightbox = backdrop;
      originalLightboxKind = kind;
    };

    const destroy = () => {
      destroyOriginalLightbox();
      if (!mounted) return;
      const current = mounted;
      mounted = null;
      current.root.unmount();
      current.host.remove();
    };

    const show = (image: HTMLImageElement) => {
      const imageData = image.src;
      if (!imageData) return;
      if (mounted?.imageData === imageData) return;
      destroy();

      const language = currentLanguage();
      const host = document.createElement("div");
      host.dataset.dunnesBarcodeOverlay = "true";
      document.body.appendChild(host);
      const root = createRoot(host);
      const label = image.alt.replace(/\s+voucher$/i, "").trim() || "Dunnes voucher";
      root.render(
        <div className={styles.backdrop} role="presentation" dir={language === "fa" ? "rtl" : undefined}>
          <VoucherScanFlow imageData={imageData} label={label} language={language} />
        </div>,
      );
      mounted = { host, root, imageData };
    };

    const sync = () => {
      const voucherImage = document.querySelector<HTMLImageElement>('.dunnes-reveal img[alt$=" voucher"]');
      if (!voucherImage) {
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
      const kind: ScanKind = trigger?.dataset.dunnesScanKind === "membership" ? "membership" : "voucher";
      event.preventDefault();
      event.stopPropagation();
      showOriginalLightbox(image, kind);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && originalLightbox) requestCloseOriginalLightbox();
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

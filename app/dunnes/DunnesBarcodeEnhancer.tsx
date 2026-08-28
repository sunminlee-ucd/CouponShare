"use client";

import { useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import VoucherScanFlow from "./VoucherScanFlow";
import styles from "./DunnesBarcodeEnhancer.module.css";

type AppLanguage = "ko" | "en" | "fa" | "ja";
type ScanKind = "voucher" | "membership";
type ScanAction = "back" | "next" | "complete";
type MountedOverlay = {
  host: HTMLDivElement;
  root: Root;
  imageData: string;
};

const LANGUAGE_STORAGE_KEY = "couponshare-language-v1";
const ORIGINAL_IMAGE_SELECTOR = 'img[alt$=" full voucher"]';
const ORIGINAL_IMAGE_TRIGGER_SELECTOR = '[data-dunnes-original-voucher-trigger="true"]';
const LIGHTBOX_ACTION_EVENT = "couponshare:dunnes-scan-lightbox-action";
const LIGHTBOX_COMPLETION_ERROR_EVENT = "couponshare:dunnes-scan-completion-error";

function currentLanguage(): AppLanguage {
  const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return saved === "en" || saved === "fa" || saved === "ja" ? saved : "ko";
}

function actionCopy(language: AppLanguage, kind: ScanKind) {
  if (language === "en") return { back: "Back", primary: kind === "membership" ? "Voucher" : "✓ Mark used", saving: "Saving…" };
  if (language === "fa") return { back: "بازگشت", primary: kind === "membership" ? "ووچر" : "✓ استفاده شد", saving: "در حال ذخیره…" };
  if (language === "ja") return { back: "戻る", primary: kind === "membership" ? "割引バウチャー" : "✓ 使用完了", saving: "保存中…" };
  return { back: "이전으로", primary: kind === "membership" ? "할인쿠폰" : "✓ 사용완료", saving: "처리 중…" };
}

export default function DunnesBarcodeEnhancer() {
  useEffect(() => {
    let mounted: MountedOverlay | null = null;
    let originalLightbox: HTMLDivElement | null = null;
    let originalLightboxKind: ScanKind | null = null;
    let completionButton: HTMLButtonElement | null = null;
    let completionStatus: HTMLParagraphElement | null = null;

    const destroyOriginalLightbox = () => {
      originalLightbox?.remove();
      originalLightbox = null;
      originalLightboxKind = null;
      completionButton = null;
      completionStatus = null;
    };

    const dispatchLightboxAction = (action: ScanAction) => {
      const kind = originalLightboxKind;
      if (!kind) return;

      // Keep the enlarged voucher on screen while the completion request runs.
      // Closing it first reveals the older scan layer underneath for a brief flash.
      if (action !== "complete") destroyOriginalLightbox();
      window.dispatchEvent(new CustomEvent(LIGHTBOX_ACTION_EVENT, { detail: { kind, action } }));
    };

    const showOriginalLightbox = (image: HTMLImageElement, kind: ScanKind) => {
      if (!image.src) return;
      destroyOriginalLightbox();

      const language = currentLanguage();
      const copy = actionCopy(language, kind);
      const backdrop = document.createElement("div");
      backdrop.className = styles.originalBackdrop;
      backdrop.setAttribute("role", "presentation");
      backdrop.dataset.dunnesOriginalVoucher = "true";

      const frame = document.createElement("div");
      frame.className = styles.originalFrame;
      frame.setAttribute("role", "dialog");
      frame.setAttribute("aria-modal", "true");
      frame.setAttribute("aria-label", kind === "membership" ? "ValueClub Card scan" : "Voucher scan");

      const actions = document.createElement("div");
      actions.className = styles.originalActions;

      const backButton = document.createElement("button");
      backButton.type = "button";
      backButton.className = styles.originalBack;
      backButton.textContent = copy.back;
      backButton.addEventListener("click", () => dispatchLightboxAction("back"));

      const primaryButton = document.createElement("button");
      primaryButton.type = "button";
      primaryButton.className = styles.originalComplete;
      primaryButton.textContent = copy.primary;
      primaryButton.addEventListener("click", () => {
        const action: ScanAction = kind === "membership" ? "next" : "complete";
        if (action === "complete") {
          primaryButton.disabled = true;
          primaryButton.textContent = copy.saving;
          primaryButton.classList.add(styles.originalCompletePending);
          if (completionStatus) completionStatus.textContent = "";
        }
        dispatchLightboxAction(action);
      });
      actions.append(backButton, primaryButton);

      const status = document.createElement("p");
      status.className = styles.originalStatus;
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");

      const fullImage = document.createElement("img");
      fullImage.className = styles.originalImage;
      fullImage.src = image.src;
      fullImage.alt = image.alt || "Original Dunnes voucher";
      fullImage.draggable = false;

      frame.addEventListener("click", (event) => event.stopPropagation());
      frame.append(actions, status, fullImage);
      backdrop.appendChild(frame);
      document.body.appendChild(backdrop);
      originalLightbox = backdrop;
      originalLightboxKind = kind;
      completionButton = kind === "voucher" ? primaryButton : null;
      completionStatus = kind === "voucher" ? status : null;
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

    const handleCompletionError = (event: Event) => {
      if (!completionButton || !originalLightbox || originalLightboxKind !== "voucher") return;
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      const copy = actionCopy(currentLanguage(), "voucher");
      completionButton.disabled = false;
      completionButton.textContent = copy.primary;
      completionButton.classList.remove(styles.originalCompletePending);
      if (completionStatus) completionStatus.textContent = detail?.message ?? "";
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && originalLightbox && !completionButton?.disabled) dispatchLightboxAction("back");
    };

    document.addEventListener("click", handleOriginalImageClick);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener(LIGHTBOX_COMPLETION_ERROR_EVENT, handleCompletionError);
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      document.removeEventListener("click", handleOriginalImageClick);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener(LIGHTBOX_COMPLETION_ERROR_EVENT, handleCompletionError);
      observer.disconnect();
      destroy();
    };
  }, []);

  return null;
}

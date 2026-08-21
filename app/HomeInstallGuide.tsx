"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage, type AppLanguage } from "./i18n";

type Platform = "android" | "ios";

type InstallCopy = {
  buttonTitle: string;
  buttonSubtitle: string;
  modalEyebrow: string;
  modalTitle: string;
  modalDescription: string;
  androidLabel: string;
  iosLabel: string;
  androidBrowser: string;
  iosBrowser: string;
  androidSteps: string[];
  iosSteps: string[];
  close: string;
};

const COPY: Record<AppLanguage, InstallCopy> = {
  ko: {
    buttonTitle: "홈 화면에 앱처럼 설치하기!",
    buttonSubtitle: "Android Chrome · iPhone Safari 설치 방법",
    modalEyebrow: "HOME SCREEN GUIDE",
    modalTitle: "CouponShare를 앱처럼 이용하세요",
    modalDescription: "사용 중인 휴대폰을 선택하면 홈 화면 바로가기 만드는 방법을 안내해 드립니다.",
    androidLabel: "Android",
    iosLabel: "iOS",
    androidBrowser: "Chrome",
    iosBrowser: "Safari",
    androidSteps: [
      "Chrome에서 CouponShare 실행",
      "오른쪽 상단 점 3개(⋮) 클릭",
      "아래로 스크롤",
      "설치 및 바로가기 만들기 클릭",
      "홈 화면에서 앱처럼 이용 가능!",
    ],
    iosSteps: [
      "Safari에서 CouponShare 실행",
      "공유 버튼(□↑) 클릭",
      "아래로 스크롤",
      "홈 화면에 추가 클릭",
      "추가(Add) 클릭",
      "홈 화면에서 앱처럼 이용 가능!",
    ],
    close: "닫기",
  },
  en: {
    buttonTitle: "Install on your Home Screen!",
    buttonSubtitle: "Android Chrome · iPhone Safari guide",
    modalEyebrow: "HOME SCREEN GUIDE",
    modalTitle: "Use CouponShare like an app",
    modalDescription: "Choose your phone to see how to add CouponShare to your Home Screen.",
    androidLabel: "Android",
    iosLabel: "iOS",
    androidBrowser: "Chrome",
    iosBrowser: "Safari",
    androidSteps: [
      "Open CouponShare in Chrome",
      "Tap the three-dot menu (⋮) at the top right",
      "Scroll down",
      "Tap Install and create shortcut",
      "Open CouponShare from your Home Screen like an app!",
    ],
    iosSteps: [
      "Open CouponShare in Safari",
      "Tap the Share button (□↑)",
      "Scroll down",
      "Tap Add to Home Screen",
      "Tap Add",
      "Open CouponShare from your Home Screen like an app!",
    ],
    close: "Close",
  },
  fa: {
    buttonTitle: "CouponShare را مثل اپ به صفحه اصلی اضافه کنید!",
    buttonSubtitle: "راهنمای Android Chrome · iPhone Safari",
    modalEyebrow: "HOME SCREEN GUIDE",
    modalTitle: "CouponShare را مثل یک اپ استفاده کنید",
    modalDescription: "نوع گوشی خود را انتخاب کنید تا روش افزودن CouponShare به صفحه اصلی را ببینید.",
    androidLabel: "Android",
    iosLabel: "iOS",
    androidBrowser: "Chrome",
    iosBrowser: "Safari",
    androidSteps: [
      "CouponShare را در Chrome باز کنید",
      "منوی سه‌نقطه (⋮) بالا سمت راست را بزنید",
      "به پایین اسکرول کنید",
      "Install and create shortcut را انتخاب کنید",
      "از صفحه اصلی مثل یک اپ وارد CouponShare شوید!",
    ],
    iosSteps: [
      "CouponShare را در Safari باز کنید",
      "دکمه Share (□↑) را بزنید",
      "به پایین اسکرول کنید",
      "Add to Home Screen را انتخاب کنید",
      "Add را بزنید",
      "از صفحه اصلی مثل یک اپ وارد CouponShare شوید!",
    ],
    close: "بستن",
  },
};

export default function HomeInstallGuide() {
  const { language } = useLanguage();
  const copy = COPY[language];
  const [target, setTarget] = useState<Element | null>(null);
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>("android");

  useEffect(() => {
    setTarget(document.querySelector(".home-overview"));
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!target) return null;

  const steps = platform === "android" ? copy.androidSteps : copy.iosSteps;
  const browser = platform === "android" ? copy.androidBrowser : copy.iosBrowser;

  const launcher = createPortal(
    <div className="home-install-guide-slot">
      <button className="home-install-guide-button" type="button" onClick={() => setOpen(true)}>
        <span className="home-install-guide-icon" aria-hidden="true">↓</span>
        <span className="home-install-guide-copy">
          <strong>{copy.buttonTitle}</strong>
          <small>{copy.buttonSubtitle}</small>
        </span>
        <span className="home-install-guide-arrow" aria-hidden="true">→</span>
      </button>
    </div>,
    target,
  );

  const modal = open ? createPortal(
    <div className="install-guide-backdrop" role="presentation">
      <button className="install-guide-dismiss" type="button" aria-label={copy.close} onClick={() => setOpen(false)} />
      <section className="install-guide-dialog" role="dialog" aria-modal="true" aria-labelledby="install-guide-title">
        <header className="install-guide-header">
          <div>
            <p>{copy.modalEyebrow}</p>
            <h2 id="install-guide-title">{copy.modalTitle}</h2>
          </div>
          <button className="install-guide-close" type="button" aria-label={copy.close} onClick={() => setOpen(false)}>×</button>
        </header>

        <p className="install-guide-description">{copy.modalDescription}</p>

        <div className="install-guide-tabs" role="tablist" aria-label="Mobile platform">
          <button
            className={platform === "android" ? "active" : ""}
            type="button"
            role="tab"
            aria-selected={platform === "android"}
            onClick={() => setPlatform("android")}
          >
            <span aria-hidden="true">A</span>
            <strong>{copy.androidLabel}</strong>
            <small>{copy.androidBrowser}</small>
          </button>
          <button
            className={platform === "ios" ? "active" : ""}
            type="button"
            role="tab"
            aria-selected={platform === "ios"}
            onClick={() => setPlatform("ios")}
          >
            <span aria-hidden="true">i</span>
            <strong>{copy.iosLabel}</strong>
            <small>{copy.iosBrowser}</small>
          </button>
        </div>

        <div className="install-guide-browser-label">
          <span aria-hidden="true">●</span>
          <strong>{browser}</strong>
        </div>

        <ol className="install-guide-steps">
          {steps.map((step, index) => (
            <li key={step}>
              <span>{index + 1}</span>
              <strong>{step}</strong>
            </li>
          ))}
        </ol>

        <button className="install-guide-done" type="button" onClick={() => setOpen(false)}>{copy.close}</button>
      </section>
    </div>,
    document.body,
  ) : null;

  return <>{launcher}{modal}</>;
}

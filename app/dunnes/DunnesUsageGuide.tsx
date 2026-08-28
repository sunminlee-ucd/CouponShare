"use client";

import { useEffect, useState } from "react";
import { type AppLanguage, useLanguage } from "../i18n";
import styles from "./DunnesUsageGuide.module.css";

type Step = { text: string; emphasis: string };
type GuideCopy = {
  button: string;
  title: string;
  close: string;
  uploaderTitle: string;
  uploaderSteps: Step[];
  userTitle: string;
  userSteps: Step[];
  valueClubTitle: string;
  valueClubLead: string;
  valueClubOrder: string;
  valueClubTail: string;
};

const COPY: Record<AppLanguage, GuideCopy> = {
  ko: {
    button: "이용방법",
    title: "이용방법",
    close: "닫기",
    uploaderTitle: "바우처를 등록하는 분",
    uploaderSteps: [
      { text: "사용하지 않을 Dunnes 바우처를 등록합니다.", emphasis: "등록합니다." },
      { text: "다른 사용자가 예약하면 바우처가 예약 상태로 변경됩니다.", emphasis: "예약 상태로 변경됩니다." },
      { text: "사용자가 `사용완료`를 누르면 등록자에게 개인 알림이 옵니다.", emphasis: "개인 알림이 옵니다." },
      { text: "실제 상태를 확인한 뒤 `계속 공유` 또는 `사용완료 처리`를 선택합니다.", emphasis: "`계속 공유` 또는 `사용완료 처리`" },
    ],
    userTitle: "바우처를 사용하는 분",
    userSteps: [
      { text: "원하는 바우처를 예약합니다.", emphasis: "예약합니다." },
      { text: "화면에 크게 표시된 바우처를 계산대에서 스캔합니다.", emphasis: "스캔합니다." },
      { text: "사용 후 `✓ 사용완료`를 눌러주세요.", emphasis: "`✓ 사용완료`" },
      { text: "이후 등록자가 실제 사용 여부를 최종 확인합니다.", emphasis: "최종 확인합니다." },
    ],
    valueClubTitle: "ValueClub Card가 있는 경우",
    valueClubLead: "반드시",
    valueClubOrder: "ValueClub Card 먼저 → 할인 바우처 나중",
    valueClubTail: "순서로 스캔해 주세요.",
  },
  en: {
    button: "How to use",
    title: "How to use",
    close: "Close",
    uploaderTitle: "If you share a voucher",
    uploaderSteps: [
      { text: "Share a Dunnes voucher you will not use.", emphasis: "Share" },
      { text: "When another user reserves it, the voucher changes to reserved status.", emphasis: "reserved status" },
      { text: "When the user taps `Mark used`, you receive a private notification.", emphasis: "private notification" },
      { text: "Check the real status and choose `Keep sharing` or `Mark as used`.", emphasis: "`Keep sharing` or `Mark as used`" },
    ],
    userTitle: "If you use a voucher",
    userSteps: [
      { text: "Reserve the voucher you want.", emphasis: "Reserve" },
      { text: "Scan the enlarged voucher at the checkout.", emphasis: "Scan" },
      { text: "After using it, tap `✓ Mark used`.", emphasis: "`✓ Mark used`" },
      { text: "The person who shared it then confirms whether it was actually used.", emphasis: "confirms whether it was actually used" },
    ],
    valueClubTitle: "If a ValueClub Card is included",
    valueClubLead: "Always scan in this order:",
    valueClubOrder: "ValueClub Card first → discount voucher second",
    valueClubTail: "",
  },
  fa: {
    button: "روش استفاده",
    title: "روش استفاده",
    close: "بستن",
    uploaderTitle: "اگر ووچر ثبت می‌کنید",
    uploaderSteps: [
      { text: "ووچر Dunnes که استفاده نمی‌کنید را ثبت کنید.", emphasis: "ثبت کنید" },
      { text: "وقتی کاربر دیگری آن را رزرو کند، ووچر به حالت رزرو تغییر می‌کند.", emphasis: "حالت رزرو" },
      { text: "وقتی کاربر `استفاده شد` را بزند، یک اعلان خصوصی دریافت می‌کنید.", emphasis: "اعلان خصوصی" },
      { text: "وضعیت واقعی را بررسی کرده و `ادامه اشتراک` یا `ثبت به‌عنوان استفاده‌شده` را انتخاب کنید.", emphasis: "`ادامه اشتراک` یا `ثبت به‌عنوان استفاده‌شده`" },
    ],
    userTitle: "اگر از ووچر استفاده می‌کنید",
    userSteps: [
      { text: "ووچر موردنظر را رزرو کنید.", emphasis: "رزرو کنید" },
      { text: "ووچر بزرگ‌شده را در صندوق اسکن کنید.", emphasis: "اسکن کنید" },
      { text: "پس از استفاده، `✓ استفاده شد` را بزنید.", emphasis: "`✓ استفاده شد`" },
      { text: "سپس ثبت‌کننده ووچر استفاده واقعی آن را تأیید می‌کند.", emphasis: "تأیید می‌کند" },
    ],
    valueClubTitle: "اگر ValueClub Card وجود دارد",
    valueClubLead: "حتماً به این ترتیب اسکن کنید:",
    valueClubOrder: "ابتدا ValueClub Card → سپس ووچر تخفیف",
    valueClubTail: "",
  },
  ja: {
    button: "利用方法",
    title: "利用方法",
    close: "閉じる",
    uploaderTitle: "バウチャーを登録する方",
    uploaderSteps: [
      { text: "使わないDunnesバウチャーを登録します。", emphasis: "登録します。" },
      { text: "他のユーザーが予約すると、バウチャーは予約状態になります。", emphasis: "予約状態になります。" },
      { text: "ユーザーが`使用完了`を押すと、登録者に個人通知が届きます。", emphasis: "個人通知が届きます。" },
      { text: "実際の状態を確認し、`共有を続ける`または`使用済みにする`を選択します。", emphasis: "`共有を続ける`または`使用済みにする`" },
    ],
    userTitle: "バウチャーを利用する方",
    userSteps: [
      { text: "使いたいバウチャーを予約します。", emphasis: "予約します。" },
      { text: "画面に大きく表示されたバウチャーをレジでスキャンします。", emphasis: "スキャンします。" },
      { text: "使用後に`✓ 使用完了`を押してください。", emphasis: "`✓ 使用完了`" },
      { text: "その後、登録者が実際に使用されたか最終確認します。", emphasis: "最終確認します。" },
    ],
    valueClubTitle: "ValueClub Cardがある場合",
    valueClubLead: "必ず",
    valueClubOrder: "ValueClub Cardを先に → 割引バウチャーを後に",
    valueClubTail: "の順番でスキャンしてください。",
  },
};

const GUIDE_BUTTON_SELECTOR = ".dunnes-hero-actions > button";

function EmphasizedStep({ step }: { step: Step }) {
  const index = step.text.indexOf(step.emphasis);
  if (index < 0) return <>{step.text}</>;
  return <>{step.text.slice(0, index)}<strong>{step.emphasis}</strong>{step.text.slice(index + step.emphasis.length)}</>;
}

export default function DunnesUsageGuide() {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const copy = COPY[language];

  useEffect(() => {
    function syncButton() {
      const button = document.querySelector<HTMLButtonElement>(GUIDE_BUTTON_SELECTOR);
      if (!button) return;
      const label = button.querySelector("span");
      if (label && label.textContent !== copy.button) label.textContent = copy.button;
      if (button.getAttribute("aria-label") !== copy.button) button.setAttribute("aria-label", copy.button);
      if (button.dataset.couponshareUsageGuide !== "true") button.dataset.couponshareUsageGuide = "true";
    }

    function interceptGuideClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest<HTMLButtonElement>(GUIDE_BUTTON_SELECTOR);
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(true);
    }

    syncButton();
    document.addEventListener("click", interceptGuideClick, true);
    const observer = new MutationObserver(syncButton);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      document.removeEventListener("click", interceptGuideClick, true);
      observer.disconnect();
    };
  }, [copy.button]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="dunnes-usage-guide-title">
        <header className={styles.header}>
          <div><p>HOW TO USE</p><h2 id="dunnes-usage-guide-title">{copy.title}</h2></div>
          <button type="button" onClick={() => setOpen(false)}>{copy.close}</button>
        </header>

        <div className={styles.grid}>
          <article className={styles.card}>
            <h3>{copy.uploaderTitle}</h3>
            <ol>{copy.uploaderSteps.map((step, index) => <li key={index}><EmphasizedStep step={step} /></li>)}</ol>
          </article>
          <article className={styles.card}>
            <h3>{copy.userTitle}</h3>
            <ol>{copy.userSteps.map((step, index) => <li key={index}><EmphasizedStep step={step} /></li>)}</ol>
          </article>
          <article className={`${styles.card} ${styles.valueClub}`}>
            <h3>{copy.valueClubTitle}</h3>
            <p>{copy.valueClubLead}</p>
            <strong className={styles.order}>{copy.valueClubOrder}</strong>
            {copy.valueClubTail && <p>{copy.valueClubTail}</p>}
          </article>
        </div>
      </section>
    </div>
  );
}

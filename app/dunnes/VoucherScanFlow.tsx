"use client";
/* eslint-disable @next/next/no-img-element -- private voucher images are data URLs */

import { useEffect, useState } from "react";
import VoucherBarcodeDisplay from "./VoucherBarcodeDisplay";
import enhancerStyles from "./DunnesBarcodeEnhancer.module.css";
import styles from "./VoucherScanFlow.module.css";

type AppLanguage = "ko" | "en" | "fa" | "ja";
type ScanStage = "voucher" | "membership";

type Props = {
  imageData: string;
  label: string;
  language: AppLanguage;
};

function requiredMembershipTotal(label: string) {
  const normalized = label.replace(/\s+/g, " ").toUpperCase();
  if (normalized.includes("€5") && normalized.includes("€25")) return 30;
  if (normalized.includes("€10") && normalized.includes("€40")) return 50;
  if (normalized.includes("€10") && normalized.includes("€50")) return 60;
  return null;
}

export default function VoucherScanFlow({ imageData, label, language }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<ScanStage>("voucher");
  const [membershipImageData, setMembershipImageData] = useState<string | null>(null);

  const copy = language === "en" ? {
    title: "Voucher scan",
    note: "Open the original voucher instantly and scan it at checkout.",
    warning: "Tap the voucher to enlarge it. Tap the enlarged image again for a closer lossless view.",
    scanned: "Done",
    confirmTitle: "Have you finished using this voucher?",
    confirmBody: "Choose Yes only after the checkout scanner has accepted the discount voucher.",
    yes: "Mark used",
    no: "Scan again",
    completing: "Saving…",
    error: "Could not mark this voucher as used. Please try again.",
    membershipTitle: "ValueClub Card scan",
    membershipNote: "Show the ValueClub Card barcode to the checkout scanner first.",
    backToMembership: "Back",
    backToVoucher: "Voucher",
    close: "Close",
    membershipZoom: "Tap ValueClub Card to enlarge",
    requiredPurchase: (total: number) => `Minimum €${total} purchase required!`,
    scanOrder: "ValueClub Card first → discount voucher second",
    penalty: "Warning: 2 or more violations will result in account removal.",
  } : language === "fa" ? {
    title: "اسکن ووچر",
    note: "تصویر اصلی ووچر را فوری باز کنید و در صندوق اسکن کنید.",
    warning: "روی ووچر بزنید تا بزرگ شود. برای نمای نزدیک‌تر بدون افت کیفیت دوباره روی تصویر بزنید.",
    scanned: "تمام",
    confirmTitle: "آیا استفاده از این ووچر واقعاً تمام شده است؟",
    confirmBody: "فقط زمانی «بله» را بزنید که اسکنر صندوق ووچر تخفیف را پذیرفته باشد.",
    yes: "استفاده شد",
    no: "اسکن دوباره",
    completing: "در حال ذخیره…",
    error: "ثبت استفاده از ووچر انجام نشد. دوباره تلاش کنید.",
    membershipTitle: "اسکن کارت ValueClub",
    membershipNote: "ابتدا بارکد کارت ValueClub را به اسکنر صندوق نشان دهید.",
    backToMembership: "بازگشت",
    backToVoucher: "ووچر",
    close: "بستن",
    membershipZoom: "برای بزرگ‌نمایی کارت ValueClub لمس کنید",
    requiredPurchase: (total: number) => `حداقل خرید €${total} الزامی است!`,
    scanOrder: "ابتدا ValueClub Card ← سپس ووچر تخفیف",
    penalty: "هشدار: با ۲ بار یا بیشتر تخلف، حساب شما حذف می‌شود.",
  } : language === "ja" ? {
    title: "バウチャーをスキャン",
    note: "元のバウチャーを開いて、レジでスキャンしてください。",
    warning: "バウチャーをタップすると拡大できます。拡大画面をもう一度タップすると、元の画質のままさらに大きく表示できます。",
    scanned: "完了",
    confirmTitle: "このバウチャーの利用は完了しましたか？",
    confirmBody: "レジのスキャナーで割引バウチャーが正常に読み取られた場合のみ「使用済みにする」を押してください。",
    yes: "使用済みにする",
    no: "もう一度スキャン",
    completing: "保存中…",
    error: "使用済みにできませんでした。もう一度お試しください。",
    membershipTitle: "ValueClub Cardをスキャン",
    membershipNote: "最初にレジのスキャナーへValueClub Cardのバーコードを提示してください。",
    backToMembership: "戻る",
    backToVoucher: "割引バウチャー",
    close: "閉じる",
    membershipZoom: "ValueClub Cardをタップして拡大",
    requiredPurchase: (total: number) => `€${total}以上の購入が必須です！`,
    scanOrder: "ValueClub Cardを先に → 割引バウチャーを後に",
    penalty: "注意：2回以上違反するとアカウントを強制退会処理します。",
  } : {
    title: "쿠폰 확대 스캔",
    note: "원본 쿠폰을 바로 열어 계산대에서 스캔하세요.",
    warning: "쿠폰을 누르면 크게 열립니다. 확대 화면을 한 번 더 누르면 원본 화질 범위에서 더 크게 볼 수 있습니다.",
    scanned: "완료",
    confirmTitle: "정말 사용 완료하셨습니까?",
    confirmBody: "계산대에서 할인 쿠폰 스캔이 정상적으로 완료된 경우에만 예를 눌러 주세요.",
    yes: "사용 완료",
    no: "다시 스캔",
    completing: "처리 중…",
    error: "사용 완료 처리하지 못했습니다. 다시 시도해 주세요.",
    membershipTitle: "ValueClub Card 스캔",
    membershipNote: "계산대 스캐너에 ValueClub Card 바코드를 먼저 보여주세요.",
    backToMembership: "이전으로",
    backToVoucher: "할인쿠폰",
    close: "닫기",
    membershipZoom: "ValueClub Card를 눌러 확대",
    requiredPurchase: (total: number) => `€${total} 이상 구매 필수!`,
    scanOrder: "ValueClub Card 먼저 → 할인쿠폰 나중",
    penalty: "주의: 2번 이상 위반 시 강제 탈퇴 처리됩니다.",
  };

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/dunnes-membership", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ imageData }),
    }).then(async (response) => {
      if (!response.ok) return;
      const result = await response.json() as { membershipImageData?: string | null };
      if (!cancelled && typeof result.membershipImageData === "string") {
        setMembershipImageData(result.membershipImageData);
      }
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [imageData]);

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

  function closeScan() {
    setError(null);
    window.location.reload();
  }

  const showingMembership = stage === "membership" && membershipImageData;
  const membershipRequiredTotal = membershipImageData ? requiredMembershipTotal(label) : null;

  return (
    <section className={enhancerStyles.dialog} role="dialog" aria-modal="true" aria-label={`${label} voucher scan`}>
      <header className={enhancerStyles.header}>
        <div>
          <strong>{showingMembership ? copy.membershipTitle : copy.title}</strong>
          <span>{showingMembership ? copy.membershipNote : copy.note}</span>
        </div>
        {!confirming && (
          <div className={styles.headerActions}>
            {showingMembership ? (
              <>
                <button type="button" className="secondary" onClick={closeScan}>{copy.close}</button>
                <button type="button" className="secondary" onClick={() => setStage("voucher")}>{copy.backToVoucher}</button>
              </>
            ) : (
              <>
                {membershipImageData && <button type="button" className="secondary" onClick={() => { setError(null); setStage("membership"); }}>{copy.backToMembership}</button>}
                <button type="button" className="secondary" onClick={() => { setError(null); setConfirming(true); }}>{copy.scanned}</button>
              </>
            )}
          </div>
        )}
      </header>

      {membershipRequiredTotal !== null && (
        <aside className="membership-rule-banner sticky" role="alert" aria-live="polite">
          <strong className="membership-rule-main">{copy.requiredPurchase(membershipRequiredTotal)}</strong>
          <span className="membership-rule-order">{copy.scanOrder}</span>
          <small className="membership-rule-penalty">{copy.penalty}</small>
        </aside>
      )}

      {confirming ? (
        <div className={styles.confirmation} role="alertdialog" aria-labelledby="dunnes-use-confirm-title" aria-describedby="dunnes-use-confirm-body">
          <div className={styles.confirmIcon} aria-hidden="true">?</div>
          <h2 id="dunnes-use-confirm-title">{copy.confirmTitle}</h2>
          <p id="dunnes-use-confirm-body">{copy.confirmBody}</p>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.actions}>
            <button type="button" className="secondary" disabled={completing} onClick={() => { setError(null); setConfirming(false); setStage("voucher"); }}>{copy.no}</button>
            <button type="button" disabled={completing} onClick={() => void completeVoucher()}>{completing ? copy.completing : copy.yes}</button>
          </div>
        </div>
      ) : showingMembership ? (
        <div className={styles.membershipPanel}>
          <p className={enhancerStyles.warning} role="note">{copy.membershipNote}</p>
          <button
            className={styles.membershipImageFrame}
            type="button"
            data-dunnes-original-voucher-trigger="true"
            aria-label={copy.membershipZoom}
          >
            <img src={membershipImageData} alt="ValueClub Card full voucher" draggable={false} />
            <span>{copy.membershipZoom}</span>
          </button>
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

"use client";
/* eslint-disable @next/next/no-img-element -- private voucher images are data URLs */

import { useEffect, useState } from "react";
import VoucherBarcodeDisplay from "./VoucherBarcodeDisplay";
import enhancerStyles from "./DunnesBarcodeEnhancer.module.css";
import styles from "./VoucherScanFlow.module.css";

type AppLanguage = "ko" | "en" | "fa" | "ja";
type ScanStage = "voucher" | "membership";
type ScanKind = "voucher" | "membership";
type ScanAction = "back" | "next" | "complete";

type Props = {
  imageData: string;
  label: string;
  language: AppLanguage;
};

const LIGHTBOX_ACTION_EVENT = "couponshare:dunnes-scan-lightbox-action";

function requiredMembershipTotal(label: string) {
  const normalized = label.replace(/\s+/g, " ").toUpperCase();
  if (normalized.includes("€5") && normalized.includes("€25")) return 30;
  if (normalized.includes("€10") && normalized.includes("€40")) return 50;
  if (normalized.includes("€10") && normalized.includes("€50")) return 60;
  return null;
}

export default function VoucherScanFlow({ imageData, label, language }: Props) {
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<ScanStage>("voucher");
  const [membershipImageData, setMembershipImageData] = useState<string | null>(null);

  const copy = language === "en" ? {
    title: "Voucher scan",
    note: "Scan the enlarged original voucher at checkout.",
    warning: "The voucher is already enlarged for scanning. Tapping the image will not zoom it again.",
    used: "Mark used",
    completing: "Saving…",
    error: "Could not update this voucher. Please try again.",
    membershipTitle: "ValueClub Card scan",
    membershipNote: "Show the ValueClub Card barcode to the checkout scanner first.",
    back: "Back",
    backToVoucher: "Voucher",
    close: "Close",
    membershipZoom: "Open ValueClub Card",
    requiredPurchase: (total: number) => `At least €${total} before discount!`,
    scanOrder: "ValueClub Card first → discount voucher second",
    penalty: "Warning: 2 or more violations will result in account removal.",
  } : language === "fa" ? {
    title: "اسکن ووچر",
    note: "ووچر اصلی بزرگ‌شده را در صندوق اسکن کنید.",
    warning: "ووچر برای اسکن از قبل بزرگ شده است و با لمس دوباره بزرگ‌تر نمی‌شود.",
    used: "استفاده شد",
    completing: "در حال ذخیره…",
    error: "به‌روزرسانی ووچر انجام نشد. دوباره تلاش کنید.",
    membershipTitle: "اسکن کارت ValueClub",
    membershipNote: "ابتدا بارکد کارت ValueClub را به اسکنر صندوق نشان دهید.",
    back: "بازگشت",
    backToVoucher: "ووچر",
    close: "بستن",
    membershipZoom: "باز کردن ValueClub Card",
    requiredPurchase: (total: number) => `مبلغ قبل از تخفیف باید حداقل €${total} باشد!`,
    scanOrder: "ابتدا ValueClub Card ← سپس ووچر تخفیف",
    penalty: "هشدار: با ۲ بار یا بیشتر تخلف، حساب شما حذف می‌شود.",
  } : language === "ja" ? {
    title: "バウチャーをスキャン",
    note: "拡大表示された元のバウチャーをレジでスキャンしてください。",
    warning: "バウチャーはすでにスキャン用に拡大されています。画像をタップしてもさらに拡大されません。",
    used: "使用完了",
    completing: "保存中…",
    error: "バウチャーの状態を更新できませんでした。もう一度お試しください。",
    membershipTitle: "ValueClub Cardをスキャン",
    membershipNote: "最初にレジのスキャナーへValueClub Cardのバーコードを提示してください。",
    back: "戻る",
    backToVoucher: "割引バウチャー",
    close: "閉じる",
    membershipZoom: "ValueClub Cardを開く",
    requiredPurchase: (total: number) => `割引前に€${total}以上の購入が必須です！`,
    scanOrder: "ValueClub Cardを先に → 割引バウチャーを後に",
    penalty: "注意：2回以上違反するとアカウントを強制退会処理します。",
  } : {
    title: "쿠폰 확대 스캔",
    note: "확대된 원본 쿠폰을 계산대에서 바로 스캔하세요.",
    warning: "이미 스캔하기 충분히 크게 표시되어 있습니다. 화면을 다시 눌러도 추가 확대되지 않습니다.",
    used: "사용완료",
    completing: "처리 중…",
    error: "쿠폰 상태를 처리하지 못했습니다. 다시 시도해 주세요.",
    membershipTitle: "ValueClub Card 스캔",
    membershipNote: "계산대 스캐너에 ValueClub Card 바코드를 먼저 보여주세요.",
    back: "이전으로",
    backToVoucher: "할인쿠폰",
    close: "닫기",
    membershipZoom: "ValueClub Card 열기",
    requiredPurchase: (total: number) => `할인 전 €${total} 이상 구매 필수!`,
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

  useEffect(() => {
    const handleLightboxAction = (event: Event) => {
      const detail = (event as CustomEvent<{ kind?: ScanKind; action?: ScanAction }>).detail;
      setError(null);
      if (detail?.kind === "membership") {
        if (detail.action === "next") setStage("voucher");
        else if (detail.action === "back") window.location.reload();
        return;
      }
      if (detail?.kind !== "voucher") return;
      if (detail.action === "complete") {
        void completeVoucher();
        return;
      }
      if (detail.action === "back") {
        if (membershipImageData) setStage("membership");
        else window.location.reload();
      }
    };
    window.addEventListener(LIGHTBOX_ACTION_EVENT, handleLightboxAction);
    return () => window.removeEventListener(LIGHTBOX_ACTION_EVENT, handleLightboxAction);
  }, [membershipImageData]);

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
        <div className={styles.headerActions}>
          {showingMembership ? (
            <>
              <button type="button" className="secondary" onClick={closeScan}>{copy.close}</button>
              <button type="button" className="secondary" onClick={() => setStage("voucher")}>{copy.backToVoucher}</button>
            </>
          ) : (
            <>
              <button type="button" className="secondary" onClick={() => membershipImageData ? setStage("membership") : closeScan()}>{copy.back}</button>
              <button type="button" disabled={completing} onClick={() => void completeVoucher()}>{completing ? copy.completing : copy.used}</button>
            </>
          )}
        </div>
      </header>

      {membershipRequiredTotal !== null && (
        <aside className="membership-rule-banner sticky" role="alert" aria-live="polite">
          <strong className="membership-rule-main">{copy.requiredPurchase(membershipRequiredTotal)}</strong>
          <span className="membership-rule-order">{copy.scanOrder}</span>
          <small className="membership-rule-penalty">{copy.penalty}</small>
        </aside>
      )}

      {error && <p className={styles.error} role="alert">{error}</p>}

      {showingMembership ? (
        <div className={styles.membershipPanel}>
          <p className={enhancerStyles.warning} role="note">{copy.membershipNote}</p>
          <button
            className={styles.membershipImageFrame}
            type="button"
            data-dunnes-original-voucher-trigger="true"
            data-dunnes-scan-kind="membership"
            aria-label={copy.membershipZoom}
          >
            <img src={membershipImageData} alt="ValueClub Card full voucher" draggable={false} />
            <span>{copy.membershipZoom}</span>
          </button>
        </div>
      ) : (
        <>
          <p className={enhancerStyles.warning} role="note">{copy.warning}</p>
          <VoucherBarcodeDisplay imageData={imageData} label={label} language={language} autoOpen />
        </>
      )}
    </section>
  );
}

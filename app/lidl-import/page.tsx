"use client";
/* eslint-disable @next/next/no-img-element, @next/next/no-html-link-for-pages -- retailer images use temporary URLs and home links require a full navigation */

import { useEffect, useRef, useState } from "react";
import IosInAppBrowserNotice from "../IosInAppBrowserNotice";
import PolicyLinks from "../PolicyLinks";
import { LIDL_ENABLED } from "../features";
import { useLanguage } from "../i18n";
import {
  buildLidlBookmarklet,
} from "./bookmarklet";
import {
  activatedPayload,
  LIDL_IMPORT_STORAGE_KEY,
  type LidlImportPayload,
} from "./storage";

type Platform = "android" | "iphone";

const LIDL_COUPON_URL = "https://www.lidl.ie/prm/promotions-list";
const COUPONSHARE_ORIGIN = "https://couponshare-ireland-493377120974.europe-west1.run.app";
const DEVICE_KEY_STORAGE_KEY = "couponshare-device-key-v2";
const ANDROID_CHROME_LIDL_URL = `intent://www.lidl.ie/prm/promotions-list#Intent;scheme=https;package=com.android.chrome;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url=${encodeURIComponent(LIDL_COUPON_URL)};end`;

export default function LidlImportPage() {
  const { t } = useLanguage();
  const [payload, setPayload] = useState<LidlImportPayload | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [platform, setPlatform] = useState<Platform>("android");
  const [hasRegisteredQr, setHasRegisteredQr] = useState<boolean | null>(null);
  const codeRef = useRef<HTMLTextAreaElement>(null);

  function acceptPayload(value: unknown) {
    const active = activatedPayload(value);
    if (!active) throw new Error("invalid payload");
    localStorage.setItem(LIDL_IMPORT_STORAGE_KEY, JSON.stringify(active));
    setPayload(active);
    setError("");
  }

  useEffect(() => {
    if (!LIDL_ENABLED) return;
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) queueMicrotask(() => setPlatform("iphone"));
    const deviceKey = localStorage.getItem(DEVICE_KEY_STORAGE_KEY);
    if (deviceKey) {
      void fetch(`/api/coupon-wallet/qr?deviceKey=${encodeURIComponent(deviceKey)}`, { cache: "no-store" })
        .then((response) => setHasRegisteredQr(response.ok))
        .catch(() => setHasRegisteredQr(false));
    } else {
      queueMicrotask(() => setHasRegisteredQr(false));
    }
    const params = new URLSearchParams(location.hash.slice(1));
    const imported = params.get("payload");
    if (!imported) return;
    history.replaceState(null, "", location.pathname + location.search);
    queueMicrotask(() => {
      try {
        const parsed: unknown = JSON.parse(imported);
        acceptPayload(parsed);
      } catch {
        setError("가져오기 결과를 읽지 못했습니다. Lidl 쿠폰 목록에서 다시 실행해 주세요.");
      }
    });
  }, []);

  function copyBookmarklet() {
    const code = buildLidlBookmarklet(COUPONSHARE_ORIGIN);
    copyText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  function copyText(value: string) {
    if (!codeRef.current) return;
    codeRef.current.value = value;
    codeRef.current.hidden = false;
    codeRef.current.select();
    try {
      const copiedWithSelection = document.execCommand("copy");
      if (!copiedWithSelection) void navigator.clipboard?.writeText(value).catch(() => undefined);
    } finally {
      codeRef.current.hidden = true;
    }
  }

  function updateMaxUnits(fingerprint: string, value: number) {
    const maxUnits = Math.max(1, Math.min(99, Math.floor(value || 1)));
    setPayload((current) => {
      if (!current) return current;
      const next = {
        ...current,
        coupons: current.coupons.map((coupon) => coupon.fingerprint === fingerprint
          ? { ...coupon, maxUnits }
          : coupon),
      };
      localStorage.setItem(LIDL_IMPORT_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  if (!LIDL_ENABLED) {
    return (
      <main className="import-shell import-disabled-shell">
        <header className="import-header">
          <a className="brand" href="/"><span className="brand-mark">C</span><span>CouponShare</span></a>
          <a className="import-home-link" href="/">{t("메인으로")}</a>
        </header>
        <section className="import-disabled-card">
          <p className="eyebrow">DUNNES ONLY</p>
          <h1>{t("Lidl 기능은 현재 운영하지 않습니다.")}</h1>
          <p>{t("CouponShare는 현재 Dunnes 무료 쿠폰 나눔을 중심으로 운영합니다.")}</p>
          <a className="import-action" href="/">{t("메인으로 돌아가기")}</a>
        </section>
        <PolicyLinks />
      </main>
    );
  }

  return (
    <main className="import-shell">
      <IosInAppBrowserNotice />
      <header className="import-header">
        <a className="brand" href="/"><span className="brand-mark">C</span><span>CouponShare</span></a>
        <a className="import-home-link" href="/">메인으로 돌아가기</a>
      </header>

      {!payload && <>
      <section className="import-hero">
        <p className="eyebrow">LIDL PLUS</p>
        <a className="import-hero-action" href={platform === "android" ? ANDROID_CHROME_LIDL_URL : LIDL_COUPON_URL}>
          Lidl 쿠폰 가져오기 <span aria-hidden="true">→</span>
        </a>
        <p>처음 한 번만 버튼을 설치하면, 다음부터는 로그인 후 바로 가져올 수 있습니다.</p>
      </section>

      <section className="import-setup" aria-labelledby="setup-title">
        <div className="import-setup-head">
          <div><span className="import-step-number">1</span><h2 id="setup-title">가져오기 버튼 설치</h2></div>
          <div className="platform-tabs" aria-label="휴대폰 선택">
            <button className={platform === "android" ? "active" : ""} onClick={() => setPlatform("android")}>Android Chrome</button>
            <button className={platform === "iphone" ? "active" : ""} onClick={() => setPlatform("iphone")}>iPhone Safari</button>
          </div>
        </div>

        <div className="import-instructions">
          {platform === "android" ? (
            <ol>
              <li><strong>가져오기 코드 복사</strong>를 누릅니다.</li>
              <li>이 페이지를 Chrome 북마크에 추가합니다.</li>
              <li>북마크 주소를 지우고 복사한 코드를 붙여넣습니다.</li>
            </ol>
          ) : (
            <ol>
              <li><strong>가져오기 코드 복사</strong>를 누릅니다.</li>
              <li>Safari 공유 버튼에서 <strong>북마크 추가</strong>를 누릅니다.</li>
              <li>북마크 주소를 지우고 복사한 코드를 붙여넣습니다.</li>
            </ol>
          )}
          <button className="import-action secondary copy-action" type="button" onClick={copyBookmarklet}>{copied ? "복사했습니다" : "가져오기 코드 복사"}</button>
          <p className="import-replace-note">이미 설치했다면 새 코드로 교체해 주세요.</p>
          <textarea ref={codeRef} className="bookmarklet-code" aria-hidden="true" hidden readOnly />
        </div>
      </section>

      </>}

      {error && <p className="import-error" role="alert">{error}</p>}

      {payload && (
        <section className="import-result" aria-labelledby="import-result-title">
          <header className="import-result-head">
            <div><p className="import-kicker">가져오기 완료</p><h2 id="import-result-title">사용 가능한 활성 쿠폰</h2></div>
            <span>{payload.coupons.length}개</span>
          </header>
          <div className="import-saved-notice">
            <div><strong>쿠폰 가져오기가 끝났습니다.</strong><span>{hasRegisteredQr ? "등록된 QR을 메인에서 바로 사용할 수 있습니다." : "이제 QR 사진을 등록해 주세요."}</span></div>
            <a className="import-action import-qr-next" href={hasRegisteredQr ? "/" : "/?qr=register"}>{hasRegisteredQr ? "메인으로 돌아가기" : "QR 등록하기"}</a>
          </div>
          <div className="import-activation-summary" aria-label="가져오기 처리 결과">
            <span>새로 활성화 <strong>{payload.newlyActivated ?? 0}개</strong></span>
            <span>사용·만료 제외 <strong>{payload.skippedUsed ?? 0}개</strong></span>
            <span>활성화 실패 <strong>{payload.activationFailures ?? 0}개</strong></span>
          </div>
          <p className="import-warning">모든 쿠폰은 기본적으로 최대 1개 할인을 적용합니다. 실제 조건이 다르면 아래 수량을 수정하세요.</p>
          <div className="import-coupon-grid">
            {payload.coupons.map((coupon) => (
              <article className="import-coupon" key={coupon.fingerprint}>
                <header>
                  <div className="import-coupon-title">
                    {coupon.imageUrl && <img src={coupon.imageUrl} alt="" />}
                    <h3>{coupon.title}</h3>
                  </div>
                  <span className={coupon.activated === false ? "import-coupon-status off" : "import-coupon-status"}>{coupon.activated === true ? "활성" : coupon.activated === false ? "비활성" : "상태 확인"}</span>
                </header>
                <dl>
                  <div><dt>할인</dt><dd>{coupon.discount ?? "확인 필요"}</dd></div>
                  <div><dt>최대 수량</dt><dd><label className="unit-editor"><input aria-label={`${coupon.title} 최대 할인 수량`} type="number" min="1" max="99" step="1" value={coupon.maxUnits ?? 1} onChange={(event) => updateMaxUnits(coupon.fingerprint, Number(event.target.value))} /><span>개</span></label></dd></div>
                  <div><dt>유효기간</dt><dd>{coupon.validUntil ?? coupon.expires ?? "확인 필요"}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </section>
      )}

      <p className="import-legal">개인 계정의 쿠폰 정보를 본인 기기에서 확인하기 위한 비공개 테스트 기능입니다. Lidl과 제휴하거나 Lidl이 보증하는 기능이 아닙니다.</p>
      <PolicyLinks />
    </main>
  );
}

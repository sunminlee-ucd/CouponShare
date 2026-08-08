"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useRef, useState } from "react";
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
const ANDROID_CHROME_LIDL_URL = `intent://www.lidl.ie/prm/promotions-list#Intent;scheme=https;package=com.android.chrome;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url=${encodeURIComponent(LIDL_COUPON_URL)};end`;

export default function LidlImportPage() {
  const [payload, setPayload] = useState<LidlImportPayload | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [lidlUrlCopied, setLidlUrlCopied] = useState(false);
  const [platform, setPlatform] = useState<Platform>("android");
  const codeRef = useRef<HTMLTextAreaElement>(null);

  function acceptPayload(value: unknown) {
    const active = activatedPayload(value);
    if (!active) throw new Error("invalid payload");
    localStorage.setItem(LIDL_IMPORT_STORAGE_KEY, JSON.stringify(active));
    setPayload(active);
    setError("");
  }

  useEffect(() => {
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) setPlatform("iphone");
    const params = new URLSearchParams(location.hash.slice(1));
    const imported = params.get("payload");
    if (!imported) return;
    history.replaceState(null, "", location.pathname + location.search);
    try {
      const parsed: unknown = JSON.parse(imported);
      acceptPayload(parsed);
    } catch {
      setError("가져오기 결과를 읽지 못했습니다. Lidl 쿠폰 목록에서 다시 실행해 주세요.");
    }
  }, []);

  async function copyBookmarklet() {
    const code = buildLidlBookmarklet(location.origin, platform === "android");
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      if (!codeRef.current) return;
      codeRef.current.value = code;
      codeRef.current.hidden = false;
      codeRef.current.select();
      document.execCommand("copy");
      codeRef.current.hidden = true;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  async function handleJsonImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      const parsed: unknown = JSON.parse(await file.text());
      acceptPayload(parsed);
    } catch {
      setPayload(null);
      setError("CouponShare가 만든 Lidl 가져오기 파일을 선택해 주세요.");
    }
  }

  async function copyLidlUrl() {
    await navigator.clipboard.writeText(LIDL_COUPON_URL);
    setLidlUrlCopied(true);
    window.setTimeout(() => setLidlUrlCopied(false), 2500);
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

  return (
    <main className="import-shell">
      <header className="import-header">
        <Link className="brand" href="/"><span className="brand-mark">C</span><span>CouponShare</span></Link>
        <Link className="import-home-link" href="/">서비스로 돌아가기</Link>
      </header>

      <section className="import-hero">
        <p className="eyebrow">LIDL PLUS · MOBILE IMPORT</p>
        <h1>로그인한 다음,<br /><span>가져오기 한 번이면 됩니다.</span></h1>
        <p>Lidl 쿠폰 목록과 각 쿠폰의 최대 적용 수량을 휴대폰 안에서 확인한 뒤 CouponShare로 가져옵니다. Lidl 비밀번호, 로그인 쿠키, QR 코드는 수집하거나 전송하지 않습니다.</p>
        <span className="import-security"><span aria-hidden="true">●</span> 상품명·할인·수량·기간·활성화 여부만 가져옵니다</span>
      </section>

      <section className="import-setup" aria-labelledby="setup-title">
        <div className="import-setup-head">
          <div><span className="import-step-number">1</span><div><p className="import-kicker">최초 한 번만</p><h2 id="setup-title">가져오기 버튼 설치</h2></div></div>
          <div className="platform-tabs" aria-label="휴대폰 선택">
            <button className={platform === "android" ? "active" : ""} onClick={() => setPlatform("android")}>Android Chrome</button>
            <button className={platform === "iphone" ? "active" : ""} onClick={() => setPlatform("iphone")}>iPhone Safari</button>
          </div>
        </div>

        <div className="import-instructions">
          <p className="import-update-note"><strong>기존 북마크를 설치했다면</strong> 코드를 다시 복사해 북마크 주소를 교체해 주세요. 저장된 코드는 자동 업데이트되지 않습니다.</p>
          {platform === "android" ? (
            <ol>
              <li>아래 버튼으로 가져오기 코드를 복사합니다.</li>
              <li>이 페이지를 Chrome 북마크에 추가하고 이름을 <strong>CouponShare 가져오기</strong>로 바꿉니다.</li>
              <li>저장한 북마크를 수정해 주소를 지우고 복사한 코드를 붙여넣습니다.</li>
            </ol>
          ) : (
            <ol>
              <li>아래 버튼으로 가져오기 코드를 복사합니다.</li>
              <li>Safari 공유 버튼에서 <strong>북마크 추가</strong>를 누르고 이름을 <strong>CouponShare 가져오기</strong>로 저장합니다.</li>
              <li>Safari 북마크의 편집을 열어 주소를 지우고 복사한 코드를 붙여넣습니다.</li>
            </ol>
          )}
          <button className="import-action secondary copy-action" type="button" onClick={copyBookmarklet}>{copied ? "복사했습니다" : "가져오기 코드 복사"}</button>
          <textarea ref={codeRef} className="bookmarklet-code" aria-hidden="true" hidden readOnly />
        </div>
      </section>

      <section className="import-run" aria-labelledby="run-title">
        <span className="import-step-number">2</span>
        <div className="import-run-copy">
          <p className="import-kicker">쿠폰을 새로 가져올 때</p>
          <h2 id="run-title">Lidl 로그인 후 가져오기</h2>
          <p>Lidl에서 로그인하고 쿠폰 목록이 나타나면, 방금 저장한 <strong>CouponShare 가져오기</strong> 북마크를 실행하세요.</p>
          <p className="import-device-hint">{platform === "android" ? "Chrome 주소창에 ‘CouponShare 가져오기’를 입력해 별표가 있는 북마크를 선택합니다." : "Lidl 주소를 복사한 뒤 Safari 앱을 열어 붙여넣으세요. 로그인 후 책 모양 버튼에서 ‘CouponShare 가져오기’를 실행합니다."}</p>
        </div>
        {platform === "android" ? (
          <a className="import-action" href={ANDROID_CHROME_LIDL_URL}>Chrome에서 Lidl 열기</a>
        ) : (
          <div className="iphone-open-actions">
            <button className="import-action" type="button" onClick={copyLidlUrl}>{lidlUrlCopied ? "주소 복사됨" : "Lidl 주소 복사"}</button>
            <a className="import-plain-link" href={LIDL_COUPON_URL}>이미 Safari라면 바로 열기</a>
          </div>
        )}
      </section>

      {error && <p className="import-error" role="alert">{error}</p>}

      {payload && (
        <section className="import-result" aria-labelledby="import-result-title">
          <header className="import-result-head">
            <div><p className="import-kicker">가져오기 완료</p><h2 id="import-result-title">사용 가능한 활성 쿠폰</h2></div>
            <span>{payload.coupons.length}개</span>
          </header>
          <div className="import-saved-notice">
            <div><strong>활성화된 쿠폰만 이 기기에 저장했습니다.</strong><span>비활성 또는 상태를 확인할 수 없는 쿠폰은 사용 가능 목록에서 제외됩니다.</span></div>
            <a className="import-action" href="/#qr-registration">QR 등록하고 메인에서 확인</a>
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
                  <div><dt>식별 코드</dt><dd>{coupon.fingerprint.slice(-6).toUpperCase()}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </section>
      )}

      <details className="import-fallback">
        <summary>JSON 파일로 가져오기</summary>
        <label className="import-file"><input type="file" accept="application/json,.json" onChange={handleJsonImport} /><strong>가져오기 JSON 선택</strong><span>데스크톱 확장 프로그램의 결과도 확인할 수 있습니다</span></label>
      </details>

      <p className="import-legal">개인 계정의 쿠폰 정보를 본인 기기에서 확인하기 위한 비공개 테스트 기능입니다. Lidl과 제휴하거나 Lidl이 보증하는 기능이 아닙니다.</p>
    </main>
  );
}

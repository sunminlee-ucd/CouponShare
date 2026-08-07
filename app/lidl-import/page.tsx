"use client";

import Link from "next/link";
import { ChangeEvent, useState } from "react";

type ImportedCoupon = {
  fingerprint: string;
  title: string;
  discount: string | null;
  maxUnits: number | null;
  expires: string | null;
  activated: boolean | null;
  capturedAt: string;
};

type ImportPayload = {
  schemaVersion: number;
  source: { url: string; host: string };
  capturedAt: string;
  coupons: ImportedCoupon[];
};

export default function LidlImportPage() {
  const [payload, setPayload] = useState<ImportPayload | null>(null);
  const [error, setError] = useState("");

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      const parsed = JSON.parse(await file.text()) as ImportPayload;
      if (parsed.schemaVersion !== 1 || parsed.source?.host !== "www.lidl.ie" || !Array.isArray(parsed.coupons)) {
        throw new Error("지원하지 않는 파일입니다.");
      }
      setPayload(parsed);
    } catch {
      setPayload(null);
      setError("CouponShare Lidl Importer가 만든 JSON 파일을 선택해 주세요.");
    }
  }

  return (
    <main className="import-shell">
      <header className="import-header">
        <Link className="brand" href="/"><span className="brand-mark">C</span><span>CouponShare</span></Link>
        <Link className="import-home-link" href="/">서비스 화면으로</Link>
      </header>

      <section className="import-hero">
        <p className="eyebrow">LIDL WEB IMPORT · PERSONAL TEST</p>
        <h1>로그인은 Lidl에서,<br /><span>쿠폰 추출은 내 브라우저에서.</span></h1>
        <p>공식 Lidl 페이지에서 직접 로그인한 다음 테스트 확장 프로그램을 실행하세요. CouponShare는 비밀번호, 로그인 쿠키 또는 QR을 받지 않습니다.</p>
        <span className="import-security"><span aria-hidden="true">●</span> 추출 결과는 JSON 파일로만 내려받습니다</span>
      </section>

      <section className="import-steps" aria-label="Lidl 쿠폰 가져오기 단계">
        <article className="import-step">
          <span className="import-step-number">1</span><h2>테스트 확장 설치</h2>
          <p>ZIP을 풀고 Chrome 확장 프로그램의 개발자 모드에서 ‘압축해제된 확장 프로그램’을 선택하세요.</p>
          <a className="import-action secondary" href="/downloads/couponshare-lidl-importer.zip" download>확장 프로그램 받기</a>
        </article>
        <article className="import-step">
          <span className="import-step-number">2</span><h2>Lidl에서 직접 로그인</h2>
          <p>공식 프로모션 페이지를 엽니다. 로그인 완료 후 페이지가 표시되면 확장 프로그램이 쿠폰 요소를 자동 분석합니다.</p>
          <a className="import-action" href="https://www.lidl.ie/prm/promotions-list" target="_blank" rel="noreferrer">Lidl 로그인 화면 열기</a>
        </article>
        <article className="import-step">
          <span className="import-step-number">3</span><h2>결과 확인</h2>
          <p>확장 프로그램에서 JSON을 내려받아 여기에 올리세요. 현재 테스트에서는 서버에 저장하지 않습니다.</p>
          <label className="import-file"><input type="file" accept="application/json,.json" onChange={handleImport} /><strong>추출 JSON 선택</strong><span>기기 안에서 미리보기</span></label>
        </article>
      </section>

      {error && <p className="import-error" role="alert">{error}</p>}
      {payload && (
        <section className="import-result" aria-labelledby="import-result-title">
          <header className="import-result-head"><h2 id="import-result-title">추출 결과</h2><span>{payload.coupons.length}개 쿠폰</span></header>
          {payload.coupons.length ? <div className="import-coupon-grid">{payload.coupons.map((coupon) => (
            <article className="import-coupon" key={coupon.fingerprint}>
              <header><h3>{coupon.title}</h3><span className={coupon.activated === false ? "import-coupon-status off" : "import-coupon-status"}>{coupon.activated === true ? "활성" : coupon.activated === false ? "비활성" : "상태 미확인"}</span></header>
              <dl>
                <div><dt>할인</dt><dd>{coupon.discount ?? "확인 필요"}</dd></div>
                <div><dt>최대 수량</dt><dd>{coupon.maxUnits ? `${coupon.maxUnits}개` : "확인 필요"}</dd></div>
                <div><dt>유효기간</dt><dd>{coupon.expires ?? "확인 필요"}</dd></div>
                <div><dt>식별값</dt><dd>{coupon.fingerprint.slice(-6)}</dd></div>
              </dl>
            </article>
          ))}</div> : <p className="import-empty">쿠폰 요소를 찾지 못했습니다. Lidl에서 로그인 후 프로모션 목록을 끝까지 표시하고 확장 프로그램의 ‘다시 추출’을 눌러 주세요.</p>}
        </section>
      )}

      <p className="import-legal">개인 계정에서의 구조 확인을 위한 테스트 도구입니다. Lidl과 제휴하거나 Lidl이 보증한 기능이 아니며, 배포·상업적 사용 전에는 Lidl의 허가와 이용약관 검토가 필요합니다.</p>
    </main>
  );
}

"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { createWorker } from "tesseract.js";

type Coupon = {
  productId: string;
  label: string;
  type: "fixed" | "percent";
  amount: number;
};

type BasketItem = {
  id: string;
  name: string;
  price: number;
  priceDetected: boolean;
};

const products = [
  { id: "milk", name: "Fresh Milk", aliases: ["FRESH MILK", "WHOLE MILK", "LOW FAT MILK", "MILK"], price: 2.35 },
  { id: "bread", name: "Wholemeal Bread", aliases: ["WHOLEMEAL", "BROWN BREAD", "BREAD"], price: 1.89 },
  { id: "chicken", name: "Chicken Fillets", aliases: ["CHICKEN FILLET", "CHICKEN BREAST", "CHICKEN"], price: 6.49 },
  { id: "coffee", name: "Ground Coffee", aliases: ["GROUND COFFEE", "COFFEE"], price: 4.99 },
  { id: "yoghurt", name: "Greek Yoghurt", aliases: ["GREEK YOGHURT", "YOGHURT", "YOGURT"], price: 2.79 },
  { id: "butter", name: "Irish Butter", aliases: ["IRISH BUTTER", "BUTTER"], price: 3.49 },
  { id: "bananas", name: "Bananas", aliases: ["BANANAS", "BANANA"], price: 1.69 },
  { id: "detergent", name: "Laundry Detergent", aliases: ["LAUNDRY", "DETERGENT"], price: 7.99 },
];

const members: Array<{
  name: string;
  initial: string;
  shared: boolean;
  coupons: Coupon[];
}> = [
  {
    name: "선민",
    initial: "선",
    shared: false,
    coupons: [
      { productId: "bread", label: "빵 20% 할인", type: "percent", amount: 0.2 },
      { productId: "yoghurt", label: "요거트 €1 할인", type: "fixed", amount: 1 },
      { productId: "butter", label: "버터 15% 할인", type: "percent", amount: 0.15 },
    ],
  },
  {
    name: "지민",
    initial: "지",
    shared: true,
    coupons: [
      { productId: "milk", label: "우유 20% 할인", type: "percent", amount: 0.2 },
      { productId: "coffee", label: "커피 €1.50 할인", type: "fixed", amount: 1.5 },
      { productId: "chicken", label: "치킨 15% 할인", type: "percent", amount: 0.15 },
      { productId: "detergent", label: "세제 €2 할인", type: "fixed", amount: 2 },
    ],
  },
  {
    name: "현우",
    initial: "현",
    shared: true,
    coupons: [
      { productId: "bananas", label: "바나나 25% 할인", type: "percent", amount: 0.25 },
      { productId: "milk", label: "우유 €0.30 할인", type: "fixed", amount: 0.3 },
      { productId: "bread", label: "빵 €0.50 할인", type: "fixed", amount: 0.5 },
    ],
  },
];

function parsePrice(line: string) {
  const matches = [...line.matchAll(/(?:€\s*)?(\d{1,3}[.,]\d{2})/g)];
  if (!matches.length) return null;
  const value = Number(matches[matches.length - 1][1].replace(",", "."));
  return Number.isFinite(value) && value < 1000 ? value : null;
}

function parseBasket(text: string): BasketItem[] {
  const lines = text
    .toUpperCase()
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return products.flatMap((product) => {
    const line = lines.find((candidate) => product.aliases.some((alias) => candidate.includes(alias)));
    if (!line) return [];
    const detectedPrice = parsePrice(line);
    return [{
      id: product.id,
      name: product.name,
      price: detectedPrice ?? product.price,
      priceDetected: detectedPrice !== null,
    }];
  });
}

function couponSaving(coupon: Coupon, item: BasketItem) {
  return coupon.type === "percent"
    ? item.price * coupon.amount
    : Math.min(item.price, coupon.amount);
}

export default function Home() {
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [basketPreview, setBasketPreview] = useState<string | null>(null);
  const [basketItems, setBasketItems] = useState<BasketItem[]>([]);
  const [sharing, setSharing] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [wholeBasket, setWholeBasket] = useState(true);
  const [scanStatus, setScanStatus] = useState<"idle" | "reading" | "done" | "error">("idle");
  const [scanProgress, setScanProgress] = useState(0);
  const [scanMessage, setScanMessage] = useState("사진을 올리면 상품명과 가격을 기기에서 읽습니다.");

  const scores = useMemo(() => members.map((member) => {
    const matches = member.coupons.flatMap((coupon) => {
      const item = basketItems.find((basketItem) => basketItem.id === coupon.productId);
      if (!item) return [];
      return [{ coupon, item, saving: couponSaving(coupon, item) }];
    });
    return {
      ...member,
      matches,
      saving: matches.reduce((total, match) => total + match.saving, 0),
    };
  }).sort((a, b) => b.saving - a.saving), [basketItems]);

  const recommended = basketItems.length ? scores[0] : { ...members[1], matches: [], saving: 8.2 };
  const totalCoupons = members.reduce((sum, member) => sum + member.coupons.length, 0);

  function handleQrUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (qrPreview) URL.revokeObjectURL(qrPreview);
    setQrPreview(URL.createObjectURL(file));
    setSharing(false);
  }

  async function analyzeBasketPhoto(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setScanStatus("error");
      setScanMessage("사진은 10MB 이하로 올려주세요.");
      return;
    }

    if (basketPreview) URL.revokeObjectURL(basketPreview);
    setBasketPreview(URL.createObjectURL(file));
    setBasketItems([]);
    setScanStatus("reading");
    setScanProgress(4);
    setScanMessage("사진을 선명하게 정리하고 있습니다…");

    let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
    try {
      worker = await createWorker("eng", undefined, {
        logger: (message) => {
          if (message.status === "recognizing text") {
            setScanProgress(Math.max(8, Math.round(message.progress * 100)));
            setScanMessage("상품 목록을 읽고 있습니다…");
          }
        },
      });
      const result = await worker.recognize(file);
      const parsed = parseBasket(result.data.text);
      setBasketItems(parsed);
      setScanProgress(100);
      if (parsed.length) {
        setScanStatus("done");
        setScanMessage(`${parsed.length}개 상품을 찾았습니다. 그룹 쿠폰 비교가 완료됐어요.`);
      } else {
        setScanStatus("error");
        setScanMessage("상품명을 찾지 못했습니다. 화면을 더 가까이, 정면에서 촬영해 주세요.");
      }
    } catch {
      setScanStatus("error");
      setScanMessage("사진을 읽지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.");
    } finally {
      await worker?.terminate();
    }
  }

  function handleBasketUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void analyzeBasketPhoto(file);
  }

  function loadSampleBasket() {
    setBasketItems([
      { id: "milk", name: "Fresh Milk", price: 2.35, priceDetected: true },
      { id: "bread", name: "Wholemeal Bread", price: 1.89, priceDetected: true },
      { id: "chicken", name: "Chicken Fillets", price: 6.49, priceDetected: true },
      { id: "coffee", name: "Ground Coffee", price: 4.99, priceDetected: true },
    ]);
    setScanStatus("done");
    setScanProgress(100);
    setScanMessage("샘플 장바구니 4개 상품으로 쿠폰을 비교했습니다.");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="CouponShare 홈">
          <span className="brand-mark">C</span>
          <span>CouponShare</span>
        </a>
        <button className="profile-button" type="button" aria-label="내 프로필">선</button>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">DUBLIN · CLOSED GROUP</p>
          <h1>장바구니를 찍으면,<br /><span>가장 좋은 쿠폰을 찾아드려요.</span></h1>
          <p className="hero-description">
            결제화면의 상품 목록을 휴대폰으로 촬영하세요. CouponShare가 기기에서
            상품과 가격을 읽고 그룹원들의 활성 쿠폰을 한 번에 비교합니다.
          </p>
        </div>
        <div className="saving-card" aria-label="이번 달 절약 요약">
          <span>우리 그룹 이번 달 절약</span>
          <strong>€34.60</strong>
          <div className="saving-meta"><span>{members.length}명 참여</span><span>{totalCoupons}개 쿠폰</span></div>
        </div>
      </section>

      <section className="scanner-wrap" aria-labelledby="scanner-title">
        <div className="scanner-copy">
          <p className="eyebrow">SMART BASKET SCAN</p>
          <h2 id="scanner-title">결제 목록 사진으로 자동 비교</h2>
          <p>상품명이 잘 보이도록 화면을 정면에서 촬영해 주세요. 사진은 서버에 업로드되지 않습니다.</p>
          <div className="scanner-actions">
            <label className="camera-button">
              <input type="file" accept="image/*" capture="environment" onChange={handleBasketUpload} />
              <span aria-hidden="true">●</span>
              결제화면 촬영 또는 선택
            </label>
            <button className="sample-button" type="button" onClick={loadSampleBasket}>샘플로 체험</button>
          </div>
          <div className={`scan-status ${scanStatus}`} aria-live="polite">
            <span>{scanStatus === "reading" ? `${scanProgress}%` : scanStatus === "done" ? "완료" : "i"}</span>
            <p>{scanMessage}</p>
          </div>
          {scanStatus === "reading" && <div className="progress-track"><span style={{ width: `${scanProgress}%` }} /></div>}
        </div>

        <div className={basketPreview ? "basket-photo has-photo" : "basket-photo"}>
          {basketPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={basketPreview} alt="분석 중인 결제화면" />
          ) : (
            <div className="phone-list" aria-hidden="true">
              <span className="phone-notch" />
              <strong>Your basket</strong>
              <i /><i /><i /><i />
            </div>
          )}
          {scanStatus === "reading" && <span className="scan-line" />}
        </div>
      </section>

      {basketItems.length > 0 && (
        <section className="recognized-strip" aria-label="인식된 장바구니 상품">
          <div><p className="eyebrow">RECOGNISED ITEMS</p><h2>{basketItems.length}개 상품 확인</h2></div>
          <div className="item-chips">
            {basketItems.map((item) => (
              <span key={item.id}>{item.name}<strong>€{item.price.toFixed(2)}</strong>{!item.priceDetected && <small>예상가</small>}</span>
            ))}
          </div>
        </section>
      )}

      <section className="content-grid">
        <div className="main-column">
          <section className="panel recommendation-panel">
            <div className="section-heading">
              <div><p className="eyebrow">BEST MATCH</p><h2>{recommended.name}님의 카드가 가장 좋아요</h2></div>
              <span className="status-pill">{recommended.shared ? "공유 중" : "내 카드"}</span>
            </div>

            <div className="recommendation-body">
              <div className="member-avatar large">{recommended.initial}</div>
              <div className="recommendation-detail">
                <span>예상 할인</span>
                <strong>€{recommended.saving.toFixed(2)}</strong>
                <p>{basketItems.length ? `${basketItems.length}개 상품 중 ${recommended.matches.length}개에 쿠폰 적용` : "장바구니 사진을 올리면 자동으로 다시 계산합니다"}</p>
              </div>
            </div>

            {recommended.matches.length > 0 && (
              <div className="coupon-match-list">
                {recommended.matches.map((match) => (
                  <div key={match.coupon.productId}>
                    <span>{match.item.name}</span>
                    <strong>{match.coupon.label} · -€{match.saving.toFixed(2)}</strong>
                  </div>
                ))}
              </div>
            )}

            <div className="points-note"><span className="info-dot">i</span><p>이 쇼핑에서 적립되는 Lidl Points와 구매내역은 {recommended.name}님의 계정에 귀속됩니다.</p></div>

            <label className="basket-rule">
              <input type="checkbox" checked={wholeBasket} onChange={(event) => setWholeBasket(event.target.checked)} />
              <span><strong>한 장바구니에는 한 카드만 사용</strong><small>그룹의 공정한 이용 약속에 동의합니다.</small></span>
            </label>

            <button className="primary-button" type="button" disabled={!wholeBasket} onClick={() => setShowQr(true)}>
              {recommended.name}님의 QR 열기 <span aria-hidden="true">→</span>
            </button>
          </section>

          <section className="panel">
            <div className="section-heading compact"><div><p className="eyebrow">GROUP WALLET</p><h2>카드별 비교</h2></div><button className="text-button" type="button">그룹 관리</button></div>
            <div className="member-list">
              {scores.map((member, index) => (
                <article className="member-row" key={member.name}>
                  <div className="member-avatar">{member.initial}</div>
                  <div className="member-name"><strong>{member.name}{basketItems.length > 0 && index === 0 ? " · 추천" : ""}</strong><span>{member.coupons.length}개 쿠폰 활성화</span></div>
                  <div className="member-saving"><span>예상 할인</span><strong>€{member.saving.toFixed(2)}</strong></div>
                  <span className={member.shared ? "share-dot on" : "share-dot"}>{member.shared ? "공유" : "비공개"}</span>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="side-column">
          <section className="panel upload-panel">
            <p className="eyebrow">MY LIDL PLUS</p><h2>내 QR 등록</h2>
            <p className="muted">QR 소유자가 직접 올리고, 허용한 그룹 멤버에게만 공개합니다.</p>
            <label className={qrPreview ? "upload-box has-image" : "upload-box"}>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleQrUpload} />
              {qrPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrPreview} alt="업로드한 QR 미리보기" />
              ) : <><span className="upload-icon" aria-hidden="true">＋</span><strong>QR 이미지 선택</strong><small>PNG, JPG 또는 WebP</small></>}
            </label>
            {qrPreview && <label className="share-toggle"><span><strong>그룹에 공유</strong><small>{sharing ? "멤버가 열람할 수 있어요" : "나만 볼 수 있어요"}</small></span><input type="checkbox" checked={sharing} onChange={(event) => setSharing(event.target.checked)} /></label>}
            <p className="prototype-note">개발 미리보기에서는 이미지가 서버에 저장되지 않습니다.</p>
          </section>

          <section className="panel trust-panel"><span className="lock-mark" aria-hidden="true">●</span><div><h3>사진은 기기 안에서 분석</h3><p>OCR 처리는 브라우저에서 실행됩니다. 초대받은 멤버만 참여하고 QR 공유는 소유자가 언제든 철회할 수 있습니다.</p></div></section>
        </aside>
      </section>

      <footer><span>© 2026 Sunmin Lee. All rights reserved.</span><span>CouponShare is not affiliated with or endorsed by Lidl.</span></footer>

      {showQr && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowQr(false)}>
          <section className="qr-modal" role="dialog" aria-modal="true" aria-labelledby="qr-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setShowQr(false)} aria-label="닫기">×</button>
            <p className="eyebrow">SHARED WITH YOUR GROUP</p><h2 id="qr-title">{recommended.name}님의 Lidl Plus QR</h2>
            <div className="qr-placeholder" aria-label="QR 코드 자리 표시자"><span>QR</span></div>
            <p className="modal-warning">이 코드는 이번 장바구니 전체에 한 번만 사용하세요. 열람 기록은 QR 소유자에게 표시됩니다.</p>
            <button className="primary-button" type="button" onClick={() => setShowQr(false)}>사용 완료</button>
          </section>
        </div>
      )}
    </main>
  );
}

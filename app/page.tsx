"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import IosInAppBrowserNotice from "./IosInAppBrowserNotice";
import {
  activatedPayload,
  LIDL_IMPORT_STORAGE_KEY,
  type LidlImportedCoupon,
} from "./lidl-import/storage";

type Coupon = {
  productId: string;
  productName?: string;
  label: string;
  type: "fixed" | "percent";
  amount: number;
  expires: string;
  maxUnits?: number | null;
  keywords?: string[];
};

type BasketItem = {
  id: string;
  name: string;
  price: number;
  priceDetected: boolean;
};

type UseSummary = {
  cardLabel: string;
  couponLabels: string[];
  cardSaving: number;
  additionalSaving: number;
  transferredPointValue: number;
  netGain: number;
};

const USED_COUPONS_STORAGE_KEY = "couponshare-used-coupons-v1";

const products = [
  { id: "milk", name: "Fresh Milk", aliases: ["FRESH MILK", "WHOLE MILK", "LOW FAT MILK", "MILK"], price: 2.35 },
  { id: "bread", name: "Wholemeal Bread", aliases: ["WHOLEMEAL", "BROWN BREAD", "BREAD"], price: 1.89 },
  { id: "chicken", name: "Chicken Fillets", aliases: ["CHICKEN FILLET", "CHICKEN BREAST", "CHICKEN"], price: 6.49 },
  { id: "coffee", name: "Ground Coffee", aliases: ["GROUND COFFEE", "COFFEE"], price: 4.99 },
  { id: "yoghurt", name: "Greek Yoghurt", aliases: ["GREEK YOGHURT", "YOGHURT", "YOGURT"], price: 2.79 },
  { id: "butter", name: "Irish Butter", aliases: ["IRISH BUTTER", "BUTTER"], price: 3.49 },
  { id: "bananas", name: "Bananas", aliases: ["BANANAS", "BANANA"], price: 1.69 },
  { id: "detergent", name: "Laundry Detergent", aliases: ["LAUNDRY", "DETERGENT"], price: 7.99 },
  { id: "onion", name: "Fresh Onions", aliases: ["FRESH ONION", "RED ONION", "WHITE ONION", "ONIONS", "ONION"], price: 1.29 },
];

const members: Array<{
  name: string;
  initial: string;
  shared: boolean;
  isCurrentUser?: boolean;
  coupons: Coupon[];
}> = [
  {
    name: "member-01",
    initial: "CS",
    shared: false,
    isCurrentUser: true,
    coupons: [
      { productId: "bread", label: "빵 20% 할인", type: "percent", amount: 0.2, expires: "11 Aug", keywords: ["loaf", "bakery", "빵"] },
      { productId: "bread", label: "빵 €0.30 할인", type: "fixed", amount: 0.3, expires: "13 Aug", keywords: ["wholemeal", "loaf", "빵"] },
      { productId: "yoghurt", label: "요거트 €1 할인", type: "fixed", amount: 1, expires: "12 Aug", keywords: ["yogurt", "dairy", "요거트"] },
      { productId: "butter", label: "버터 15% 할인", type: "percent", amount: 0.15, expires: "14 Aug", keywords: ["irish butter", "dairy", "버터"] },
      { productId: "onion", label: "양파 30% 할인", type: "percent", amount: 0.3, expires: "10 Aug", keywords: ["onions", "red onion", "white onion", "양파"] },
    ],
  },
  {
    name: "member-02",
    initial: "CS",
    shared: true,
    coupons: [
      { productId: "milk", label: "우유 20% 할인", type: "percent", amount: 0.2, expires: "13 Aug", keywords: ["whole milk", "low fat", "dairy", "우유"] },
      { productId: "coffee", label: "커피 €1.50 할인", type: "fixed", amount: 1.5, expires: "16 Aug", keywords: ["ground coffee", "instant coffee", "커피"] },
      { productId: "chicken", label: "치킨 15% 할인", type: "percent", amount: 0.15, expires: "11 Aug", keywords: ["fillet", "breast", "poultry", "닭"] },
      { productId: "detergent", label: "세제 €2 할인", type: "fixed", amount: 2, expires: "18 Aug", keywords: ["laundry", "washing", "세제"] },
      { productId: "onion", label: "양파 €0.40 할인", type: "fixed", amount: 0.4, expires: "12 Aug", keywords: ["onions", "fresh onion", "vegetable", "양파"] },
    ],
  },
  {
    name: "member-03",
    initial: "CS",
    shared: true,
    coupons: [
      { productId: "bananas", label: "바나나 25% 할인", type: "percent", amount: 0.25, expires: "10 Aug", keywords: ["banana", "fruit", "바나나"] },
      { productId: "milk", label: "우유 €0.30 할인", type: "fixed", amount: 0.3, expires: "15 Aug", keywords: ["fresh milk", "dairy", "우유"] },
      { productId: "bread", label: "빵 €0.50 할인", type: "fixed", amount: 0.5, expires: "17 Aug", keywords: ["wholemeal", "loaf", "빵"] },
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

function importedCoupon(coupon: LidlImportedCoupon): Coupon {
  const normalizedTitle = coupon.title.toLocaleUpperCase();
  const product = products.find((candidate) => candidate.aliases.some((alias) => normalizedTitle.includes(alias)));
  const percent = coupon.discount?.match(/(\d+(?:[.,]\d+)?)\s*%/);
  const fixed = coupon.discount?.match(/€\s*(\d+(?:[.,]\d+)?)/)
    ?? coupon.discount?.match(/(\d+(?:[.,]\d+)?)\s*€/);
  const amount = Number((percent?.[1] ?? fixed?.[1] ?? "0").replace(",", "."));
  return {
    productId: product?.id ?? coupon.fingerprint,
    productName: coupon.title,
    label: coupon.discount ?? "할인 조건 확인 필요",
    type: percent ? "percent" : "fixed",
    amount: percent ? amount / 100 : amount,
    expires: coupon.validUntil ?? coupon.expires ?? "기간 확인 필요",
    maxUnits: coupon.maxUnits,
    keywords: [coupon.title],
  };
}

function dailyAnonymousId(memberName: string) {
  const now = new Date();
  const dateKey = [now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate()]
    .map((part) => String(part).padStart(2, "0"))
    .join("");
  let hash = 2166136261;
  for (const character of `${dateKey}:${memberName}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `CS-${(hash >>> 0).toString(36).toUpperCase().padStart(7, "0").slice(0, 7)}`;
}

function maskedCardLabel(memberName: string, isCurrentUser?: boolean) {
  if (isCurrentUser) return "내 카드";
  return `공유 카드 · ${dailyAnonymousId(memberName).slice(-3)}`;
}

function couponKey(memberName: string, coupon: Coupon) {
  return [memberName, coupon.productId, coupon.label, coupon.expires].join("::");
}

export default function Home() {
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [basketPreview, setBasketPreview] = useState<string | null>(null);
  const [basketItems, setBasketItems] = useState<BasketItem[]>([]);
  const [sharing, setSharing] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrRevealed, setQrRevealed] = useState(false);
  const [usePhase, setUsePhase] = useState<"qr" | "confirm" | "result">("qr");
  const [revealSeconds, setRevealSeconds] = useState(12);
  const [pointCount, setPointCount] = useState(0);
  const [selectedCardName, setSelectedCardName] = useState<string | null>(null);
  const [wholeBasket, setWholeBasket] = useState(true);
  const [scanStatus, setScanStatus] = useState<"idle" | "reading" | "done" | "error">("idle");
  const [scanProgress, setScanProgress] = useState(0);
  const [scanMessage, setScanMessage] = useState("사진을 올리면 상품명과 가격을 기기에서 읽습니다.");
  const [couponKeyword, setCouponKeyword] = useState("");
  const [importedActiveCoupons, setImportedActiveCoupons] = useState<Coupon[] | null>(null);
  const [importedAt, setImportedAt] = useState<string | null>(null);
  const [usedCouponKeys, setUsedCouponKeys] = useState<string[]>([]);
  const [selectedUseCouponKeys, setSelectedUseCouponKeys] = useState<string[]>([]);
  const [lastUseSummary, setLastUseSummary] = useState<UseSummary | null>(null);
  const [lastRemovedKeys, setLastRemovedKeys] = useState<string[]>([]);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LIDL_IMPORT_STORAGE_KEY);
      if (!saved) return;
      const payload = activatedPayload(JSON.parse(saved));
      if (!payload) return;
      setImportedActiveCoupons(payload.coupons.map(importedCoupon));
      setImportedAt(payload.capturedAt);
    } catch {
      localStorage.removeItem(LIDL_IMPORT_STORAGE_KEY);
    }
    try {
      const used = JSON.parse(localStorage.getItem(USED_COUPONS_STORAGE_KEY) ?? "[]");
      if (Array.isArray(used) && used.every((item) => typeof item === "string")) setUsedCouponKeys(used);
    } catch {
      localStorage.removeItem(USED_COUPONS_STORAGE_KEY);
    }
  }, []);

  const effectiveMembers = useMemo(() => members.map((member) => {
    const coupons = member.isCurrentUser && importedActiveCoupons
      ? importedActiveCoupons
      : member.coupons;
    return {
      ...member,
      coupons: coupons.filter((coupon) => !usedCouponKeys.includes(couponKey(member.name, coupon))),
    };
  }), [importedActiveCoupons, usedCouponKeys]);

  const scores = useMemo(() => effectiveMembers
    .filter((member) => member.shared || member.isCurrentUser)
    .map((member) => {
    const bestMatchByProduct = new Map<string, { coupon: Coupon; item: BasketItem; saving: number }>();
    member.coupons.forEach((coupon) => {
      const item = basketItems.find((basketItem) => basketItem.id === coupon.productId);
      if (!item) return;
      const candidate = { coupon, item, saving: couponSaving(coupon, item) };
      const current = bestMatchByProduct.get(coupon.productId);
      if (!current || candidate.saving > current.saving) {
        bestMatchByProduct.set(coupon.productId, candidate);
      }
    });
    const matches = [...bestMatchByProduct.values()];
    return {
      ...member,
      matches,
      saving: matches.reduce((total, match) => total + match.saving, 0),
    };
  }), [basketItems, effectiveMembers]);

  const pointValue = pointCount * 0.01;
  const ownCard = scores.find((member) => member.isCurrentUser) ?? { ...effectiveMembers[0], matches: [], saving: 0 };
  const rankedScores = useMemo(() => scores
    .map((member) => ({
      ...member,
      effectiveValue: member.saving - (member.isCurrentUser ? 0 : pointValue),
    }))
    .sort((a, b) => b.effectiveValue - a.effectiveValue), [scores, pointValue]);
  const recommended = basketItems.length
    ? rankedScores[0]
    : { ...effectiveMembers[1], matches: [], saving: 0, effectiveValue: 0 };
  const totalCoupons = effectiveMembers.reduce((sum, member) => sum + member.coupons.length, 0);
  const normalizedKeyword = couponKeyword.trim().toLocaleLowerCase();
  const visibleCouponGroups = effectiveMembers.map((member) => ({
    ...member,
    coupons: member.coupons.filter((coupon) => {
      if (!normalizedKeyword) return true;
      const productName = coupon.productName ?? products.find((product) => product.id === coupon.productId)?.name ?? coupon.productId;
      const searchable = [productName, coupon.label, ...(coupon.keywords ?? [])]
        .join(" ")
        .toLocaleLowerCase();
      return searchable.includes(normalizedKeyword);
    }),
  }));
  const visibleCouponCount = visibleCouponGroups.reduce((sum, member) => sum + member.coupons.length, 0);
  const additionalCouponSaving = Math.max(0, recommended.saving - ownCard.saving);
  const transferredPointValue = recommended.isCurrentUser ? 0 : pointValue;
  const netGain = additionalCouponSaving - transferredPointValue;
  const activeQrCard = rankedScores.find((member) => member.name === selectedCardName) ?? recommended;
  const usedAdditionalSaving = Math.max(0, activeQrCard.saving - ownCard.saving);
  const usedTransferredPointValue = activeQrCard.isCurrentUser ? 0 : pointValue;
  const usedNetGain = usedAdditionalSaving - usedTransferredPointValue;
  const ownCouponCount = effectiveMembers.find((member) => member.isCurrentUser)?.coupons.length ?? 0;
  const registrationReady = Boolean(qrPreview && ownCouponCount > 0 && sharing);

  useEffect(() => {
    if (!showQr) return;
    const concealQr = () => {
      setQrRevealed(false);
      setRevealSeconds(12);
    };
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") concealQr();
    };
    window.addEventListener("blur", concealQr);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("blur", concealQr);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [showQr]);

  useEffect(() => {
    if (!showQr || !qrRevealed) return;
    const timer = window.setInterval(() => {
      setRevealSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setQrRevealed(false);
          return 12;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [showQr, qrRevealed]);

  function openQrFor(memberName: string) {
    setSelectedCardName(memberName);
    setQrRevealed(false);
    setUsePhase("qr");
    setSelectedUseCouponKeys([]);
    setLastUseSummary(null);
    setRevealSeconds(12);
    setShowQr(true);
  }

  function openQr() {
    openQrFor(recommended.name);
  }

  function closeQr() {
    setQrRevealed(false);
    setUsePhase("qr");
    setSelectedUseCouponKeys([]);
    setRevealSeconds(12);
    setShowQr(false);
  }

  function finishQrUse() {
    setQrRevealed(false);
    setRevealSeconds(12);
    setSelectedUseCouponKeys(activeQrCard.matches.map((match) => couponKey(activeQrCard.name, match.coupon)));
    setUsePhase("confirm");
  }

  function handleQrDismiss() {
    if (qrRevealed || usePhase === "qr") {
      finishQrUse();
      return;
    }
    closeQr();
  }

  function revealQr() {
    setRevealSeconds(12);
    setQrRevealed(true);
  }

  function toggleUsedCoupon(key: string) {
    setSelectedUseCouponKeys((current) => current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key]);
  }

  function confirmCouponsUsed() {
    if (!selectedUseCouponKeys.length) return;
    const labels = activeQrCard.coupons
      .filter((coupon) => selectedUseCouponKeys.includes(couponKey(activeQrCard.name, coupon)))
      .map((coupon) => coupon.productName ?? products.find((product) => product.id === coupon.productId)?.name ?? coupon.label);
    const nextKeys = [...new Set([...usedCouponKeys, ...selectedUseCouponKeys])];
    setUsedCouponKeys(nextKeys);
    localStorage.setItem(USED_COUPONS_STORAGE_KEY, JSON.stringify(nextKeys));
    setLastRemovedKeys(selectedUseCouponKeys);
    setLastUseSummary({
      cardLabel: maskedCardLabel(activeQrCard.name, activeQrCard.isCurrentUser),
      couponLabels: labels,
      cardSaving: activeQrCard.saving,
      additionalSaving: usedAdditionalSaving,
      transferredPointValue: usedTransferredPointValue,
      netGain: usedNetGain,
    });
    setActionNotice(`${labels.length}개 쿠폰을 사용 완료로 처리했어요.`);
    setUsePhase("result");
  }

  function keepCouponsAvailable() {
    setActionNotice("사용하지 않은 것으로 기록했어요. 쿠폰은 그대로 남아 있습니다.");
    closeQr();
  }

  function undoLastUse() {
    const nextKeys = usedCouponKeys.filter((key) => !lastRemovedKeys.includes(key));
    setUsedCouponKeys(nextKeys);
    localStorage.setItem(USED_COUPONS_STORAGE_KEY, JSON.stringify(nextKeys));
    setActionNotice("사용 처리를 되돌렸어요. 쿠폰이 목록에 다시 표시됩니다.");
    setLastRemovedKeys([]);
    closeQr();
  }

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

    let worker: {
      recognize: (image: File) => Promise<{ data: { text: string } }>;
      terminate: () => Promise<unknown>;
    } | null = null;
    try {
      const { createWorker } = await import("tesseract.js");
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
      setPointCount(Math.max(0, Math.floor(parsed.reduce((sum, item) => sum + item.price, 0))));
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
    const sampleItems = [
      { id: "milk", name: "Fresh Milk", price: 2.35, priceDetected: true },
      { id: "bread", name: "Wholemeal Bread", price: 1.89, priceDetected: true },
      { id: "chicken", name: "Chicken Fillets", price: 6.49, priceDetected: true },
      { id: "coffee", name: "Ground Coffee", price: 4.99, priceDetected: true },
    ];
    setBasketItems(sampleItems);
    setPointCount(Math.floor(sampleItems.reduce((sum, item) => sum + item.price, 0)));
    setScanStatus("done");
    setScanProgress(100);
    setScanMessage("샘플 장바구니 4개 상품으로 쿠폰을 비교했습니다.");
  }

  return (
    <main className="app-shell">
      <IosInAppBrowserNotice />
      <header className="topbar">
        <a className="brand" href="#top" aria-label="CouponShare 홈">
          <span className="brand-mark">C</span>
          <span>CouponShare</span>
        </a>
        <a className="profile-button" href="/admin" aria-label="관리자 페이지">CS</a>
      </header>

      {actionNotice && (
        <div className="action-notice" role="status">
          <span aria-hidden="true">✓</span><strong>{actionNotice}</strong>
          <button type="button" onClick={() => setActionNotice(null)} aria-label="알림 닫기">×</button>
        </div>
      )}

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">DUBLIN · CLOSED GROUP</p>
          <h1>내 쿠폰을 나누고,<br /><span>필요한 순간 함께 써요.</span></h1>
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

      <nav className="flow-guide" aria-label="CouponShare 이용 순서">
        <a className={registrationReady ? "flow-step done" : "flow-step active"} href="#qr-registration">
          <span>{registrationReady ? "✓" : "1"}</span><div><strong>공유 준비</strong><small>쿠폰과 QR 등록</small></div>
        </a>
        <a className={basketItems.length ? "flow-step done" : "flow-step"} href="#coupon-search-title">
          <span>{basketItems.length ? "✓" : "2"}</span><div><strong>쿠폰 비교</strong><small>상대 카드 확인</small></div>
        </a>
        <a className="flow-step" href="#best-card">
          <span>3</span><div><strong>사용 확인</strong><small>쓴 쿠폰 자동 정리</small></div>
        </a>
      </nav>

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

      <section className="coupon-directory" aria-labelledby="coupon-search-title">
        <div className="coupon-directory-head">
          <div>
            <p className="eyebrow">ACTIVE COUPON FINDER</p>
            <h2 id="coupon-search-title">그룹의 활성 쿠폰 찾기</h2>
            <p>상품명의 일부만 입력해도 모든 멤버의 활성 쿠폰에서 찾아드립니다.</p>
          </div>
          <label className="coupon-search-box">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={couponKeyword}
              onChange={(event) => setCouponKeyword(event.target.value)}
              placeholder="예: onion, milk, bread"
              aria-label="활성 쿠폰 상품명 검색"
            />
            {couponKeyword && <button type="button" onClick={() => setCouponKeyword("")} aria-label="검색어 지우기">×</button>}
          </label>
        </div>

        <div className="search-summary" aria-live="polite">
          {normalizedKeyword ? (
            <span><strong>“{couponKeyword.trim()}”</strong> 검색 결과 {visibleCouponCount}개</span>
          ) : <span>총 {totalCoupons}개 활성 쿠폰 · 멤버별 보기</span>}
        </div>

        {visibleCouponCount > 0 ? (
          <div className="coupon-owner-grid">
            {visibleCouponGroups.map((member) => (
              <article className={member.coupons.length ? "coupon-owner-card" : "coupon-owner-card empty"} key={member.name}>
                <header>
                  <div className="member-avatar">CS</div>
                  <div><strong>{maskedCardLabel(member.name, member.isCurrentUser)}</strong><span>{member.coupons.length}개 일치 · 매일 표식 변경</span></div>
                  <span className={member.shared ? "share-dot on" : "share-dot"}>{member.shared ? "공유" : "내 카드"}</span>
                </header>
                {member.coupons.length ? (
                  <div className="active-coupon-list">
                    {member.coupons.map((coupon) => {
                      const product = products.find((item) => item.id === coupon.productId);
                      return (
                        <div className="active-coupon" key={`${member.name}-${coupon.productId}-${coupon.label}`}>
                          <div><strong>{coupon.productName ?? product?.name ?? coupon.productId}</strong><span>{coupon.label}</span></div>
                          <small>{coupon.maxUnits ? `최대 ${coupon.maxUnits}개 · ` : ""}{coupon.expires} 만료</small>
                        </div>
                      );
                    })}
                  </div>
                ) : <p className="no-member-match">이 멤버에게는 일치하는 쿠폰이 없습니다.</p>}
                {member.shared && member.coupons.length > 0 && (
                  <button className="card-use-button" type="button" onClick={() => openQrFor(member.name)}>
                    이 카드 QR 사용하기 <span aria-hidden="true">→</span>
                  </button>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="no-coupon-results">
            <strong>“{couponKeyword.trim()}” 쿠폰을 찾지 못했어요.</strong>
            <span>상품명의 다른 부분이나 영문 이름으로 다시 검색해 보세요.</span>
          </div>
        )}
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
          <section className="panel recommendation-panel" id="best-card">
            <div className="section-heading">
              <div><p className="eyebrow">BEST NET VALUE</p><h2>{recommended.isCurrentUser ? "내 카드가 가장 유리해요" : "익명 공유 카드가 더 유리해요"}</h2></div>
              <span className="status-pill">{recommended.shared ? "공유 중" : "내 카드"}</span>
            </div>

            <div className="recommendation-body">
              <div className="member-avatar large">CS</div>
              <div className="recommendation-detail">
                <span>포인트 반영 후 실질 가치</span>
                <strong>€{recommended.effectiveValue.toFixed(2)}</strong>
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

            <div className="optimizer-rule">
              <span aria-hidden="true">✓</span>
              <div><strong>동일 상품에는 최고 절약 쿠폰 1개만</strong><p>공유가 허용된 카드 안에서 할인율과 고정할인을 실제 유로 절약액으로 비교해 가장 큰 쿠폰만 선택합니다.</p></div>
            </div>

            <div className="value-comparison" aria-label="내 카드 대비 실질 이득 비교">
              <div><span>내 카드 할인</span><strong>€{ownCard.saving.toFixed(2)}</strong></div>
              <div><span>공유 카드 추가 할인</span><strong>+€{additionalCouponSaving.toFixed(2)}</strong></div>
              <div><span>넘기는 포인트 가치</span><strong>-€{transferredPointValue.toFixed(2)}</strong></div>
              <div className="net-value"><span>내 카드 대비 최종 순이득</span><strong>{netGain >= 0 ? "+" : "-"}€{Math.abs(netGain).toFixed(2)}</strong></div>
            </div>

            <div className="points-note"><span className="info-dot">i</span><p>1포인트 = €0.01로 계산합니다. 초기 포인트는 결제금액 €1당 1포인트로 예상하며 사용 결과 창에서 수정할 수 있습니다.</p></div>

            <label className="basket-rule" aria-label="한 장바구니에 한 카드만 사용하기">
              <input type="checkbox" checked={wholeBasket} onChange={(event) => setWholeBasket(event.target.checked)} />
              <span><strong>한 장바구니에는 한 카드만 사용</strong><small>그룹의 공정한 이용 약속에 동의합니다.</small></span>
            </label>

            <button className="primary-button" type="button" disabled={!wholeBasket} onClick={openQr}>
              추천 QR 보호 화면 열기 <span aria-hidden="true">→</span>
            </button>
          </section>

          <section className="panel">
            <div className="section-heading compact"><div><p className="eyebrow">GROUP WALLET</p><h2>카드별 비교</h2></div><button className="text-button" type="button">그룹 관리</button></div>
            <div className="member-list">
              {rankedScores.map((member, index) => (
                <article className="member-row" key={member.name}>
                  <div className="member-avatar">CS</div>
                  <div className="member-name"><strong>{maskedCardLabel(member.name, member.isCurrentUser)}{basketItems.length > 0 && index === 0 ? " · 추천" : ""}</strong><span>{member.coupons.length}개 쿠폰 활성화 · 소유자 비공개</span></div>
                  <div className="member-saving"><span>예상 할인</span><strong>€{member.saving.toFixed(2)}</strong></div>
                  {member.shared ? (
                    <button className="member-use-button" type="button" onClick={() => openQrFor(member.name)}>QR 열기</button>
                  ) : <span className="share-dot">비공개</span>}
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="side-column">
          <section className="panel upload-panel" id="qr-registration">
            <p className="eyebrow">MY LIDL PLUS</p><h2>내 QR 등록</h2>
            <p className="muted">QR 소유자가 직접 올리고, 허용한 그룹 멤버에게만 공개합니다.</p>
            {importedActiveCoupons && (
              <div className="main-import-status" role="status">
                <span aria-hidden="true">✓</span>
                <div><strong>활성 쿠폰 {importedActiveCoupons.length}개 입력 완료</strong><small>{importedAt ? `${new Date(importedAt).toLocaleString("en-IE")} 기준 · ` : ""}이제 아래에서 QR 이미지만 선택하세요.</small></div>
              </div>
            )}
            <a className="web-import-link" href="/lidl-import"><span aria-hidden="true">↗</span><strong>Lidl 웹에서 쿠폰 가져오기</strong><small>로그인 후 가져오기 한 번으로 쿠폰·수량 확인</small></a>
            <label className={qrPreview ? "upload-box has-image" : "upload-box"}>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleQrUpload} />
              {qrPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrPreview} alt="업로드한 QR 미리보기" />
              ) : <><span className="upload-icon" aria-hidden="true">＋</span><strong>QR 이미지 선택</strong><small>PNG, JPG 또는 WebP</small></>}
            </label>
            {qrPreview && <label className="share-toggle" aria-label="QR을 그룹에 공유하기"><span><strong>그룹에 공유</strong><small>{sharing ? "멤버가 열람할 수 있어요" : "나만 볼 수 있어요"}</small></span><input type="checkbox" checked={sharing} onChange={(event) => setSharing(event.target.checked)} /></label>}
            <div className={registrationReady ? "registration-status ready" : "registration-status"}>
              <span aria-hidden="true">{registrationReady ? "✓" : "i"}</span>
              <p>{registrationReady ? "공유 준비가 끝났어요. 이제 상대방 쿠폰을 비교하고 QR을 열 수 있습니다." : "활성 쿠폰과 QR을 등록한 뒤 ‘그룹에 공유’를 켜 주세요."}</p>
            </div>
            <p className="prototype-note">현재 버전의 QR과 사용 기록은 이 기기에만 저장됩니다. 여러 기기 간 실제 공유에는 그룹 인증과 서버 저장소 연결이 필요합니다.</p>
          </section>

          <section className="panel trust-panel"><span className="lock-mark" aria-hidden="true">●</span><div><h3>사진은 기기 안에서 분석</h3><p>OCR 처리는 브라우저에서 실행됩니다. QR 소유자 정보는 숨기지만, 스캔 가능한 QR의 캡처·복사를 기술적으로 완전히 막을 수는 없습니다.</p></div></section>
        </aside>
      </section>

      <footer><span>© 2026 Sunmin Lee. All rights reserved.</span><span>CouponShare is not affiliated with or endorsed by Lidl.</span></footer>

      {showQr && (
        <div className="modal-backdrop">
          <button className="modal-dismiss-layer" type="button" onClick={handleQrDismiss} aria-label="QR 보호 화면 닫기" />
          <section className="qr-modal" role="dialog" aria-modal="true" aria-labelledby="qr-title">
            <button className="modal-close" type="button" onClick={handleQrDismiss} aria-label={qrRevealed ? "QR 사용 결과 보기" : "닫기"}>×</button>
            {usePhase === "result" && lastUseSummary ? (
              <div className="use-result">
                <p className="eyebrow">ALL DONE</p><h2 id="qr-title">사용 처리가 완료됐어요</h2>
                <p className="result-friendly-copy">{lastUseSummary.couponLabels.join(", ")} 쿠폰을 활성 목록에서 정리했습니다.</p>
                <label className="point-editor" aria-label="예상 적립 포인트 수정">
                  <span>다른 계정으로 넘어가는 예상 포인트</span>
                  <span><input type="number" min="0" step="1" value={pointCount} onChange={(event) => setPointCount(Math.max(0, Number(event.target.value) || 0))} /> pt</span>
                </label>
                <div className="result-ledger">
                  <div><span>내 카드 쿠폰 할인</span><strong>€{ownCard.saving.toFixed(2)}</strong></div>
                  <div><span>사용한 QR 쿠폰 할인</span><strong>€{lastUseSummary.cardSaving.toFixed(2)}</strong></div>
                  <div><span>추가로 받은 할인</span><strong>+€{lastUseSummary.additionalSaving.toFixed(2)}</strong></div>
                  <div><span>포인트 가치 · 1pt = €0.01</span><strong>-€{lastUseSummary.transferredPointValue.toFixed(2)}</strong></div>
                  <div className="result-total"><span>최종 순이득</span><strong>{lastUseSummary.netGain >= 0 ? "+" : "-"}€{Math.abs(lastUseSummary.netGain).toFixed(2)}</strong></div>
                </div>
                <p className="result-privacy">QR 소유자와 연결되는 이름이나 전체 ID는 표시하지 않습니다.</p>
                <button className="primary-button" type="button" onClick={closeQr}>확인하고 닫기</button>
                <button className="undo-button" type="button" onClick={undoLastUse}>잘못 처리했어요 · 쿠폰 되돌리기</button>
              </div>
            ) : usePhase === "confirm" ? (
              <div className="use-confirm">
                <p className="eyebrow">QUICK CHECK</p><h2 id="qr-title">쿠폰을 실제로 사용했나요?</h2>
                <p>사용한 쿠폰만 선택해 주세요. 확인하면 활성 쿠폰 목록에서 바로 사라집니다.</p>
                <div className="used-coupon-checklist">
                  {activeQrCard.coupons.map((coupon) => {
                    const key = couponKey(activeQrCard.name, coupon);
                    const product = products.find((item) => item.id === coupon.productId);
                    return (
                      <label key={key}>
                        <input type="checkbox" checked={selectedUseCouponKeys.includes(key)} onChange={() => toggleUsedCoupon(key)} />
                        <span><strong>{coupon.productName ?? product?.name ?? coupon.productId}</strong><small>{coupon.label}</small></span>
                      </label>
                    );
                  })}
                </div>
                <button className="primary-button" type="button" disabled={!selectedUseCouponKeys.length} onClick={confirmCouponsUsed}>
                  {selectedUseCouponKeys.length ? `${selectedUseCouponKeys.length}개 사용 완료 처리` : "사용한 쿠폰을 선택해 주세요"}<span aria-hidden="true">✓</span>
                </button>
                <button className="not-used-button" type="button" onClick={keepCouponsAvailable}>아니요, 사용하지 않았어요</button>
              </div>
            ) : <>
              <p className="eyebrow">PROTECTED QR REVEAL</p><h2 id="qr-title">추천 QR</h2>
              <div className="qr-product-list" aria-label="이 QR로 할인받을 상품">
                {activeQrCard.matches.length ? activeQrCard.matches.map((match) => (
                  <div key={match.coupon.productId}><span>{match.item.name}</span><strong>-€{match.saving.toFixed(2)}</strong></div>
                )) : <p>장바구니를 인식하면 적용 상품만 여기에 표시됩니다.</p>}
              </div>
              {qrRevealed ? (
                <div
                  className="qr-reveal-area"
                  onContextMenu={(event) => event.preventDefault()}
                  onDragStart={(event) => event.preventDefault()}
                >
                  <span className="countdown-pill" aria-live="polite">{revealSeconds}초 후 자동 숨김</span>
                  {qrPreview && activeQrCard.isCurrentUser ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="protected-qr-image" src={qrPreview} alt="일시적으로 공개된 Lidl Plus QR" draggable={false} />
                  ) : <div className="qr-placeholder" aria-label="QR 코드 자리 표시자"><span>QR</span></div>}
                  <span className="qr-watermark" aria-hidden="true">CouponShare · 일회성 열람</span>
                </div>
              ) : (
                <div className="qr-covered">
                  <span className="shield-mark" aria-hidden="true">●</span>
                  <strong>QR이 가려져 있습니다</strong>
                  <p>계산대 스캐너 앞에서만 여세요. 12초 뒤 또는 앱 전환 시 즉시 다시 숨깁니다.</p>
                  <button className="reveal-button" type="button" onClick={revealQr}>12초 동안 QR 표시</button>
                </div>
              )}
              <p className="qr-privacy-line">소유자 이름과 전체 ID는 숨겨집니다 · 화면 전환 시 QR 자동 숨김</p>
              <button className="primary-button" type="button" onClick={finishQrUse}>스캔 완료 · 결과 보기</button>
            </>}
          </section>
        </div>
      )}
    </main>
  );
}

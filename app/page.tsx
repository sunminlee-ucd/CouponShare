"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import IosInAppBrowserNotice from "./IosInAppBrowserNotice";
import {
  activatedPayload,
  LIDL_IMPORT_STORAGE_KEY,
  type LidlImportedCoupon,
} from "./lidl-import/storage";
import { parseLidlReceipt, receiptItemMatchesCoupon } from "./receipt-parser";

type Coupon = {
  externalKey?: string;
  productId: string;
  productName?: string;
  label: string;
  type: "fixed" | "percent";
  amount: number;
  expires: string;
  maxUnits?: number | null;
  keywords?: string[];
};

type Member = {
  name: string;
  initial: string;
  shared: boolean;
  isCurrentUser?: boolean;
  qrAvailable?: boolean;
  coupons: Coupon[];
};

type WalletApiResult = {
  usedKeys?: string[];
  qrViewsRemaining?: number;
  members?: Array<{
    id: string;
    isCurrentUser: boolean;
    qrAvailable: boolean;
    coupons: Coupon[];
  }>;
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

const USED_COUPONS_STORAGE_KEY = "couponshare-used-coupons-v2";
const DEVICE_KEY_STORAGE_KEY = "couponshare-device-key-v2";

function getDeviceKey() {
  const saved = localStorage.getItem(DEVICE_KEY_STORAGE_KEY);
  if (saved) return saved;
  const created = crypto.randomUUID();
  localStorage.setItem(DEVICE_KEY_STORAGE_KEY, created);
  return created;
}

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

const ownMember: Member = {
  name: "member-01",
  initial: "CS",
  shared: false,
  isCurrentUser: true,
  coupons: [],
};

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
  return coupon.externalKey ?? [memberName, coupon.productId, coupon.label, coupon.expires].join("::");
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function cropQrImage(file: File) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();

    const scanScale = Math.min(1, 2000 / Math.max(image.naturalWidth, image.naturalHeight));
    const scanCanvas = document.createElement("canvas");
    scanCanvas.width = Math.max(1, Math.round(image.naturalWidth * scanScale));
    scanCanvas.height = Math.max(1, Math.round(image.naturalHeight * scanScale));
    const scanContext = scanCanvas.getContext("2d", { willReadFrequently: true });
    if (!scanContext) throw new Error("canvas unavailable");
    scanContext.drawImage(image, 0, 0, scanCanvas.width, scanCanvas.height);

    const { default: jsQR } = await import("jsqr");
    const pixels = scanContext.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
    const detected = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: "attemptBoth" });
    if (!detected) throw new Error("qr not found");

    const corners = [
      detected.location.topLeftCorner,
      detected.location.topRightCorner,
      detected.location.bottomLeftCorner,
      detected.location.bottomRightCorner,
    ];
    const minX = Math.min(...corners.map((point) => point.x)) / scanScale;
    const maxX = Math.max(...corners.map((point) => point.x)) / scanScale;
    const minY = Math.min(...corners.map((point) => point.y)) / scanScale;
    const maxY = Math.max(...corners.map((point) => point.y)) / scanScale;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const cropSize = Math.min(
      Math.max(maxX - minX, maxY - minY) * 1.3,
      image.naturalWidth,
      image.naturalHeight,
    );
    const cropX = Math.min(Math.max(0, centerX - cropSize / 2), image.naturalWidth - cropSize);
    const cropY = Math.min(Math.max(0, centerY - cropSize / 2), image.naturalHeight - cropSize);
    const outputSize = Math.min(1200, Math.max(480, Math.round(cropSize)));
    const output = document.createElement("canvas");
    output.width = outputSize;
    output.height = outputSize;
    const outputContext = output.getContext("2d");
    if (!outputContext) throw new Error("canvas unavailable");
    outputContext.fillStyle = "#ffffff";
    outputContext.fillRect(0, 0, outputSize, outputSize);
    outputContext.drawImage(image, cropX, cropY, cropSize, cropSize, 0, 0, outputSize, outputSize);
    return {
      dataUrl: output.toDataURL("image/png"),
      fingerprint: await sha256Hex(new Uint8Array(detected.binaryData)),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"coupons" | "receipt" | "wallet">("coupons");
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [qrFingerprint, setQrFingerprint] = useState<string | null>(null);
  const [remoteQrPreview, setRemoteQrPreview] = useState<string | null>(null);
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
  const [databaseSync, setDatabaseSync] = useState<"checking" | "connected" | "local">("checking");
  const [deviceKey, setDeviceKey] = useState<string | null>(null);
  const [sharedMembers, setSharedMembers] = useState<Member[]>([]);
  const [qrViewsRemaining, setQrViewsRemaining] = useState(3);
  const [quickRegistration, setQuickRegistration] = useState(false);
  const [qrCropStatus, setQrCropStatus] = useState<"idle" | "cropping" | "done" | "error">("idle");

  function applyWalletResult(result: WalletApiResult) {
    const current = result.members?.find((member) => member.isCurrentUser);
    setSharing(Boolean(current));
    setSharedMembers((result.members ?? [])
      .filter((member) => !member.isCurrentUser)
      .map((member) => ({
        name: member.id,
        initial: "CS",
        shared: true,
        qrAvailable: member.qrAvailable,
        coupons: member.coupons,
      })));
    if (typeof result.qrViewsRemaining === "number") setQrViewsRemaining(result.qrViewsRemaining);
  }

  useEffect(() => {
    const startsWithQrRegistration = new URLSearchParams(location.search).get("qr") === "register";
    setQuickRegistration(startsWithQrRegistration);
    if (startsWithQrRegistration) setActiveTab("wallet");
    let active = true;
    let importedCoupons: Coupon[] | null = null;
    let capturedAt: string | null = null;

    try {
      const saved = localStorage.getItem(LIDL_IMPORT_STORAGE_KEY);
      const payload = saved ? activatedPayload(JSON.parse(saved)) : null;
      if (payload) {
        importedCoupons = payload.coupons.map(importedCoupon);
        capturedAt = payload.capturedAt;
        const loadedCoupons = importedCoupons;
        const loadedAt = capturedAt;
        queueMicrotask(() => {
          if (!active) return;
          setImportedActiveCoupons(loadedCoupons);
          setImportedAt(loadedAt);
        });
      }
    } catch {
      localStorage.removeItem(LIDL_IMPORT_STORAGE_KEY);
    }

    let localUsedKeys: string[] = [];
    try {
      const used = JSON.parse(localStorage.getItem(USED_COUPONS_STORAGE_KEY) ?? "[]");
      if (Array.isArray(used) && used.every((item) => typeof item === "string")) {
        localUsedKeys = used;
        const loadedUsedKeys = used;
        queueMicrotask(() => {
          if (active) setUsedCouponKeys(loadedUsedKeys);
        });
      }
    } catch {
      localStorage.removeItem(USED_COUPONS_STORAGE_KEY);
    }

    const deviceKey = getDeviceKey();
    setDeviceKey(deviceKey);
    const request = importedCoupons
      ? fetch("/api/coupon-wallet", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "sync",
            deviceKey,
            coupons: importedCoupons.map((coupon) => ({
              externalKey: couponKey("member-01", coupon),
              productId: coupon.productId,
              productName: coupon.productName ?? null,
              label: coupon.label,
              discountType: coupon.type,
              amount: coupon.amount,
              expiresText: coupon.expires,
              maxUnits: coupon.maxUnits ?? 1,
              keywords: coupon.keywords ?? [],
              sourceCapturedAt: capturedAt,
            })),
          }),
        })
      : fetch(`/api/coupon-wallet?deviceKey=${encodeURIComponent(deviceKey)}`);

    void request.then(async (response) => {
      if (!response.ok) throw new Error("Database unavailable");
      const result = await response.json() as WalletApiResult;
      if (!active) return;
      const nextUsedKeys = [...new Set([...localUsedKeys, ...(result.usedKeys ?? [])])];
      setUsedCouponKeys(nextUsedKeys);
      localStorage.setItem(USED_COUPONS_STORAGE_KEY, JSON.stringify(nextUsedKeys));
      applyWalletResult(result);
      setDatabaseSync("connected");
    }).catch(() => {
      if (active) setDatabaseSync("local");
    });

    return () => {
      active = false;
    };
  }, []);

  function persistCouponUsage(action: "mark_used" | "undo_used", externalKeys: string[]) {
    void fetch("/api/coupon-wallet", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, deviceKey: getDeviceKey(), externalKeys }),
    }).then((response) => {
      if (response.ok) setDatabaseSync("connected");
    }).catch(() => setDatabaseSync("local"));
  }

  useEffect(() => {
    if (!deviceKey || databaseSync !== "connected") return;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/coupon-wallet?deviceKey=${encodeURIComponent(deviceKey)}`, { cache: "no-store" });
        if (!response.ok) return;
        applyWalletResult(await response.json() as WalletApiResult);
      } catch {
        // The local wallet remains usable while the next refresh retries.
      }
    };
    const timer = window.setInterval(refresh, 10_000);
    return () => window.clearInterval(timer);
  }, [databaseSync, deviceKey]);

  const effectiveMembers = useMemo(() => {
    const current: Member = {
      ...ownMember,
      shared: sharing,
      coupons: (importedActiveCoupons ?? []).filter((coupon) => !usedCouponKeys.includes(couponKey(ownMember.name, coupon))),
    };
    return [current, ...sharedMembers];
  }, [importedActiveCoupons, sharing, sharedMembers, usedCouponKeys]);

  const scores = useMemo(() => effectiveMembers
    .filter((member) => member.shared || member.isCurrentUser)
    .map((member) => {
    const bestMatchByProduct = new Map<string, { coupon: Coupon; item: BasketItem; saving: number }>();
    member.coupons.forEach((coupon) => {
      const item = basketItems.find((basketItem) => receiptItemMatchesCoupon(basketItem, coupon, products));
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
    : { ...ownCard, matches: [], saving: 0, effectiveValue: 0 };
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
  const qrLimitReached = !activeQrCard.isCurrentUser && qrViewsRemaining <= 0;
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

  function openCouponCard(member: Member) {
    if (member.isCurrentUser && !qrPreview) {
      setQuickRegistration(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      setActionNotice("이 쿠폰을 사용하려면 먼저 내 QR 사진을 등록해 주세요.");
      return;
    }
    openQrFor(member.name);
  }

  function closeQr() {
    if (remoteQrPreview) URL.revokeObjectURL(remoteQrPreview);
    setRemoteQrPreview(null);
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

  async function revealQr() {
    if (!activeQrCard.isCurrentUser && deviceKey && activeQrCard.qrAvailable) {
      if (qrViewsRemaining <= 0) {
        setActionNotice("오늘 공유 QR 열람 3회를 모두 사용했습니다. 내일 다시 이용해 주세요.");
        return;
      }
      try {
        const response = await fetch("/api/coupon-wallet/qr", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ deviceKey, ownerId: activeQrCard.name }),
          cache: "no-store",
        });
        if (response.status === 429) {
          setQrViewsRemaining(0);
          setActionNotice("오늘 공유 QR 열람 3회를 모두 사용했습니다. 내일 다시 이용해 주세요.");
          return;
        }
        if (!response.ok) throw new Error("QR unavailable");
        const remaining = Number(response.headers.get("x-qr-views-remaining"));
        if (Number.isFinite(remaining)) setQrViewsRemaining(Math.max(0, remaining));
        if (remoteQrPreview) URL.revokeObjectURL(remoteQrPreview);
        setRemoteQrPreview(URL.createObjectURL(await response.blob()));
      } catch {
        setActionNotice("공유 QR을 불러오지 못했어요. 상대방이 공유를 다시 켰는지 확인해 주세요.");
        return;
      }
    }
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
    persistCouponUsage("mark_used", selectedUseCouponKeys);
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
    persistCouponUsage("undo_used", lastRemovedKeys);
    setActionNotice("사용 처리를 되돌렸어요. 쿠폰이 목록에 다시 표시됩니다.");
    setLastRemovedKeys([]);
    closeQr();
  }

  async function handleQrUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    if (file.size > 12 * 1024 * 1024) {
      setActionNotice("QR 화면 사진은 12MB 이하로 올려주세요.");
      return;
    }
    setSharing(false);
    setQrFingerprint(null);
    setQrCropStatus("cropping");
    try {
      const cropped = await cropQrImage(file);
      setQrPreview(cropped.dataUrl);
      setQrFingerprint(cropped.fingerprint);
      setQrCropStatus("done");
      setActionNotice("QR 부분만 자동으로 잘랐어요. 미리보기를 확인하고 등록해 주세요.");
    } catch {
      setQrPreview(null);
      setQrFingerprint(null);
      setQrCropStatus("error");
      setActionNotice("사진에서 QR을 찾지 못했어요. QR이 가려지지 않게 화면 전체를 다시 올려주세요.");
    }
  }

  async function updateSharing(nextSharing: boolean) {
    if (!deviceKey) return;
    if (nextSharing && (!qrPreview || !qrFingerprint || !importedActiveCoupons?.length)) {
      setActionNotice("활성 쿠폰과 QR 이미지를 먼저 등록해 주세요.");
      return;
    }
    setDatabaseSync("checking");
    try {
      const response = await fetch("/api/coupon-wallet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "set_sharing",
          deviceKey,
          sharing: nextSharing,
          qrData: nextSharing ? qrPreview : null,
          qrFingerprint: nextSharing ? qrFingerprint : null,
        }),
      });
      if (response.status === 409) {
        setDatabaseSync("connected");
        setSharing(false);
        setActionNotice("이미 다른 카드에 등록된 QR입니다. 본인의 다른 QR 화면을 확인해 주세요.");
        return;
      }
      if (!response.ok) throw new Error("Share failed");
      applyWalletResult(await response.json() as WalletApiResult);
      setDatabaseSync("connected");
      setActionNotice(nextSharing
        ? "공유가 시작됐어요. 같은 테스트 그룹의 쿠폰 목록에 곧 표시됩니다."
        : "QR 공유를 중지했어요.");
    } catch {
      setDatabaseSync("local");
      setActionNotice("공유 저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
    }
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
      const parsed = parseLidlReceipt(result.data.text, products);
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

      {quickRegistration && (
        <section className="quick-qr-registration" aria-labelledby="quick-qr-title">
          <div className="quick-qr-copy">
            <p className="eyebrow">쿠폰 가져오기 완료</p>
            <h2 id="quick-qr-title">이제 QR 사진만 등록하세요</h2>
            <p>{importedActiveCoupons ? `사용 가능한 활성 쿠폰 ${importedActiveCoupons.length}개를 가져왔습니다.` : "가져온 쿠폰을 확인하고 있습니다."} QR이 있는 화면 전체를 올리면 QR 부분만 자동으로 잘라냅니다.</p>
          </div>
          <div className="quick-qr-actions">
            {qrPreview ? (
              <div className="quick-qr-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrPreview} alt="자동으로 잘라낸 QR 미리보기" />
                <span>QR 영역 자동 자르기 완료</span>
              </div>
            ) : (
              <label className={qrCropStatus === "cropping" ? "quick-upload-button busy" : "quick-upload-button"}>
                <input type="file" accept="image/png,image/jpeg,image/webp" disabled={!importedActiveCoupons || qrCropStatus === "cropping"} onChange={(event) => void handleQrUpload(event)} />
                {qrCropStatus === "cropping" ? "QR 찾는 중…" : qrCropStatus === "error" ? "다른 사진으로 다시 등록" : "QR 사진 등록"}
              </label>
            )}
            {qrPreview && (
              <button className="quick-share-button" type="button" disabled={sharing || databaseSync === "checking"} onClick={() => void updateSharing(true)}>
                {sharing ? "등록 및 공유 완료" : databaseSync === "checking" ? "등록 중…" : "QR 등록하고 공유 시작"}
              </button>
            )}
          </div>
        </section>
      )}

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
          <div className="saving-meta"><span>{effectiveMembers.length}명 참여</span><span>{totalCoupons}개 쿠폰</span></div>
        </div>
      </section>

      <div className="main-tabs" aria-label="CouponShare 주요 기능" role="tablist">
        <button className={activeTab === "coupons" ? "active" : ""} type="button" role="tab" aria-selected={activeTab === "coupons"} onClick={() => setActiveTab("coupons")}><span>⌕</span><strong>쿠폰 찾기</strong></button>
        <button className={activeTab === "receipt" ? "active" : ""} type="button" role="tab" aria-selected={activeTab === "receipt"} onClick={() => setActiveTab("receipt")}><span>▤</span><strong>영수증 분석</strong></button>
        <button className={activeTab === "wallet" ? "active" : ""} type="button" role="tab" aria-selected={activeTab === "wallet"} onClick={() => setActiveTab("wallet")}><span>▣</span><strong>QR 공유</strong><small>{qrViewsRemaining}/3 남음</small></button>
      </div>

      <section className="scanner-wrap" id="receipt-tab-panel" role="tabpanel" hidden={activeTab !== "receipt"} aria-labelledby="scanner-title">
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

      <section className="coupon-directory" id="coupon-tab-panel" role="tabpanel" hidden={activeTab !== "coupons"} aria-labelledby="coupon-search-title">
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
                        <button className="active-coupon" type="button" onClick={() => openCouponCard(member)} key={`${member.name}-${coupon.productId}-${coupon.label}`} aria-label={`${coupon.productName ?? product?.name ?? coupon.productId} 쿠폰으로 QR 열기`}>
                          <div><strong>{coupon.productName ?? product?.name ?? coupon.productId}</strong><span>{coupon.label}</span></div>
                          <small>{coupon.maxUnits ? `최대 ${coupon.maxUnits}개 · ` : ""}{coupon.expires} 만료</small>
                          <b aria-hidden="true">→</b>
                        </button>
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

      {activeTab === "receipt" && basketItems.length > 0 && (
        <section className="recognized-strip" aria-label="인식된 장바구니 상품">
          <div><p className="eyebrow">RECOGNISED ITEMS</p><h2>{basketItems.length}개 상품 확인</h2></div>
          <div className="item-chips">
            {basketItems.map((item) => (
              <span key={item.id}>{item.name}<strong>€{item.price.toFixed(2)}</strong>{!item.priceDetected && <small>예상가</small>}</span>
            ))}
          </div>
        </section>
      )}

      <section className={`content-grid tab-content-grid ${activeTab}`} hidden={activeTab === "coupons"}>
        <div className="main-column">
          <section className="panel recommendation-panel" id="best-card" hidden={activeTab !== "receipt"}>
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

            <label className="basket-rule" aria-label="한 장바구니에 한 카드만 사용하기">
              <input type="checkbox" checked={wholeBasket} onChange={(event) => setWholeBasket(event.target.checked)} />
              <span><strong>한 장바구니에는 한 카드만 사용</strong><small>그룹의 공정한 이용 약속에 동의합니다.</small></span>
            </label>

            <button className="primary-button" type="button" disabled={!wholeBasket} onClick={openQr}>
              추천 QR 보호 화면 열기 <span aria-hidden="true">→</span>
            </button>
          </section>

          <section className="panel" hidden={activeTab !== "wallet"}>
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

        <aside className="side-column" hidden={activeTab !== "wallet"}>
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
              <input type="file" accept="image/png,image/jpeg,image/webp" disabled={qrCropStatus === "cropping"} onChange={(event) => void handleQrUpload(event)} />
              {qrPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrPreview} alt="자동으로 잘라낸 QR 미리보기" />
              ) : <><span className="upload-icon" aria-hidden="true">＋</span><strong>{qrCropStatus === "cropping" ? "QR 부분을 찾는 중…" : "QR 화면 사진 선택"}</strong><small>QR 부분만 자동으로 잘라냅니다</small></>}
            </label>
            {qrCropStatus === "done" && <p className="qr-crop-note">✓ QR 부분만 자동으로 잘라 선명하게 준비했습니다.</p>}
            {qrCropStatus === "error" && <p className="qr-crop-note error">QR이 화면 안에 모두 보이는 사진으로 다시 시도해 주세요.</p>}
            {qrPreview && <label className="share-toggle" aria-label="QR을 그룹에 공유하기"><span><strong>그룹에 공유</strong><small>{sharing ? "멤버가 열람할 수 있어요" : "나만 볼 수 있어요"}</small></span><input type="checkbox" checked={sharing} onChange={(event) => void updateSharing(event.target.checked)} /></label>}
            <div className={registrationReady ? "registration-status ready" : "registration-status"}>
              <span aria-hidden="true">{registrationReady ? "✓" : "i"}</span>
              <p>{registrationReady ? "공유 준비가 끝났어요. 이제 상대방 쿠폰을 비교하고 QR을 열 수 있습니다." : "활성 쿠폰과 QR을 등록한 뒤 ‘그룹에 공유’를 켜 주세요."}</p>
            </div>
            <p className="prototype-note">
              {databaseSync === "connected"
                ? "쿠폰과 사용 기록이 PostgreSQL에 안전하게 동기화되고 있습니다."
                : databaseSync === "checking"
                  ? "안전한 저장소 연결을 확인하고 있습니다."
                  : "현재는 이 기기에 저장 중입니다. PostgreSQL 연결이 복구되면 자동으로 다시 동기화합니다."}
            </p>
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
                  ) : remoteQrPreview && activeQrCard.qrAvailable ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="protected-qr-image"
                      src={remoteQrPreview}
                      alt="그룹에서 공유된 Lidl Plus QR"
                      draggable={false}
                    />
                  ) : <div className="qr-placeholder" aria-label="QR 코드 자리 표시자"><span>QR</span></div>}
                  <span className="qr-watermark" aria-hidden="true">CouponShare · 일회성 열람</span>
                </div>
              ) : (
                <div className="qr-covered">
                  <span className="shield-mark" aria-hidden="true">●</span>
                  <strong>QR이 가려져 있습니다</strong>
                  <p>{qrLimitReached ? "오늘 공유 QR 열람 3회를 모두 사용했습니다." : `계산대 스캐너 앞에서만 여세요. 오늘 ${qrViewsRemaining}회 남았습니다.`}</p>
                  <button className="reveal-button" type="button" disabled={qrLimitReached} onClick={revealQr}>{qrLimitReached ? "내일 다시 이용 가능" : "12초 동안 QR 표시"}</button>
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

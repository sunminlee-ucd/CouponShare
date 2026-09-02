"use client";
/* eslint-disable @next/next/no-img-element -- private barcode data URLs cannot use the Next image optimizer */

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import IosInAppBrowserNotice from "../IosInAppBrowserNotice";
import PolicyLinks from "../PolicyLinks";
import { useLanguage } from "../i18n";
import styles from "./page.module.css";

type VoucherType = "5off25" | "10off40" | "10off50";
type Voucher = {
  id: string;
  voucher_type: VoucherType;
  barcode_masked: string;
  image_data: string | null;
  membership_required: boolean;
  membership_image_data: string | null;
  expires_on: string;
  status: "available" | "reserved" | "used" | "expired" | "rejected";
  review_status: "pending" | "approved" | "rejected";
  is_mine: boolean;
  reserved_by_me: boolean;
  reserved_until: string | null;
};

const DEVICE_KEY_STORAGE_KEY = "couponshare-device-key-v2";
const CLIENT_IMAGE_LENGTH_LIMIT = 700_000;
const REQUEST_TIMEOUT_MS = 20_000;
const UPLOAD_REQUEST_TIMEOUT_MS = 45_000;
const OCR_TIMEOUT_MS = 8_000;

function canvasToCompressedDataUrl(source: HTMLCanvasElement) {
  let canvas = source;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const dataUrl = canvas.toDataURL("image/jpeg", attempt === 0 ? 0.82 : 0.74);
    if (dataUrl.length <= CLIENT_IMAGE_LENGTH_LIMIT) return dataUrl;
    const scale = Math.max(0.55, Math.min(0.88, Math.sqrt(CLIENT_IMAGE_LENGTH_LIMIT / dataUrl.length) * 0.92));
    const resized = document.createElement("canvas");
    resized.width = Math.max(1, Math.round(canvas.width * scale));
    resized.height = Math.max(1, Math.round(canvas.height * scale));
    const context = resized.getContext("2d");
    if (!context) throw new Error("canvas unavailable");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, resized.width, resized.height);
    context.drawImage(canvas, 0, 0, resized.width, resized.height);
    canvas = resized;
  }
  const dataUrl = canvas.toDataURL("image/jpeg", 0.68);
  if (dataUrl.length > CLIENT_IMAGE_LENGTH_LIMIT) throw new Error("image too large");
  return dataUrl;
}

function getDeviceKey() {
  const saved = localStorage.getItem(DEVICE_KEY_STORAGE_KEY);
  if (saved) return saved;
  const created = crypto.randomUUID();
  localStorage.setItem(DEVICE_KEY_STORAGE_KEY, created);
  return created;
}

function futureDateFromDayMonth(day: number, monthText: string) {
  const months: Record<string, number> = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
  const month = months[monthText];
  if (month === undefined || !Number.isInteger(day) || day < 1 || day > 31) return "";
  const now = new Date();
  let result = new Date(Date.UTC(now.getUTCFullYear(), month, day));
  if (result.getUTCDate() !== day || result.getUTCMonth() !== month) return "";
  if (result.getTime() < now.getTime() - 45 * 24 * 60 * 60 * 1000) {
    result = new Date(Date.UTC(now.getUTCFullYear() + 1, month, day));
  }
  return result.toISOString().slice(0, 10);
}

function parseExpiry(text: string) {
  const upper = text.toUpperCase().replace(/[–—]/g, "-").replace(/\s+/g, " ");
  const rangeMatch = upper.match(/VALID\s+(?:FROM\s+)?\d{1,2}\s+[A-Z]{3}\s*(?:-|TO)\s*(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/);
  if (rangeMatch) return futureDateFromDayMonth(Number(rangeMatch[1]), rangeMatch[2]);
  const singleMatch = upper.match(/(?:VALID\s+(?:UNTIL|TO)|EXPIRES?(?:\s+ON)?)\s*(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/);
  return singleMatch ? futureDateFromDayMonth(Number(singleMatch[1]), singleMatch[2]) : "";
}

function parseBarcode(text: string) {
  return (text.match(/(?:\d[\s-]*){10,16}/g) ?? [])
    .map((value) => value.replace(/\D/g, ""))
    .filter((value) => value.length >= 10 && value.length <= 16)
    .sort((a, b) => {
      const aKnown = /^(?:227|270)\d{9,10}$/.test(a) ? 1 : 0;
      const bKnown = /^(?:227|270)\d{9,10}$/.test(b) ? 1 : 0;
      return bKnown - aKnown || b.length - a.length;
    })[0] ?? "";
}

function parseVoucherType(text: string): VoucherType | null {
  const upper = text.toUpperCase().replace(/[–—]/g, "-").replace(/\s+/g, " ");
  if (/10\s*(?:EURO\s*)?OFF[\s\S]{0,80}(?:€\s*)?50\b/.test(upper) || /SPEND\s+(?:€\s*)?50\b/.test(upper)) return "10off50";
  if (/10\s*(?:EURO\s*)?OFF[\s\S]{0,80}(?:€\s*)?40\b/.test(upper) || /SPEND\s+(?:€\s*)?40\b/.test(upper)) return "10off40";
  if (/5\s*(?:EURO\s*)?OFF[\s\S]{0,80}(?:€\s*)?25\b/.test(upper) || /SPEND\s+(?:€\s*)?25\b/.test(upper)) return "5off25";
  return null;
}

function todayInDublin() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin" }).format(new Date());
}

function loadBrowserImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) resolve(image);
      else reject(new Error("invalid image dimensions"));
    };
    image.onerror = () => reject(new Error("image decode failed"));
    image.src = url;
  });
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number) {
  let timeout: ReturnType<typeof window.setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = window.setTimeout(() => reject(new Error("timeout")), milliseconds);
      }),
    ]);
  } finally {
    if (timeout !== undefined) window.clearTimeout(timeout);
  }
}

async function compressVoucherImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadBrowserImage(url);
    const scale = Math.min(1, 1100 / image.naturalWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas unavailable");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvasToCompressedDataUrl(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function cropValueClubCard(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadBrowserImage(url);

    const analysisScale = Math.min(1, 1000 / image.naturalWidth);
    const analysis = document.createElement("canvas");
    analysis.width = Math.max(1, Math.round(image.naturalWidth * analysisScale));
    analysis.height = Math.max(1, Math.round(image.naturalHeight * analysisScale));
    const context = analysis.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("canvas unavailable");
    context.drawImage(image, 0, 0, analysis.width, analysis.height);
    const pixels = context.getImageData(0, 0, analysis.width, analysis.height).data;
    const isCardGreen = (offset: number) => {
      const red = pixels[offset];
      const green = pixels[offset + 1];
      const blue = pixels[offset + 2];
      return green >= 45 && green <= 165 && red < 125 && blue < 135 && green > red * 1.2 && green > blue * 1.12;
    };

    const activeRows: boolean[] = [];
    for (let y = 0; y < analysis.height; y += 1) {
      let greenPixels = 0;
      for (let x = 0; x < analysis.width; x += 2) {
        if (isCardGreen((y * analysis.width + x) * 4)) greenPixels += 2;
      }
      activeRows[y] = greenPixels >= analysis.width * 0.06;
    }

    const segments: Array<{ top: number; bottom: number }> = [];
    let segmentStart = -1;
    for (let y = 0; y <= activeRows.length; y += 1) {
      if (activeRows[y] && segmentStart < 0) segmentStart = y;
      if ((!activeRows[y] || y === activeRows.length) && segmentStart >= 0) {
        if (y - segmentStart >= Math.max(40, analysis.width * 0.15)) segments.push({ top: segmentStart, bottom: y - 1 });
        segmentStart = -1;
      }
    }
    const card = segments.sort((a, b) => (b.bottom - b.top) - (a.bottom - a.top))[0];
    if (!card) return compressVoucherImage(file);

    let left = analysis.width;
    let right = 0;
    for (let y = card.top; y <= card.bottom; y += 1) {
      for (let x = 0; x < analysis.width; x += 1) {
        if (!isCardGreen((y * analysis.width + x) * 4)) continue;
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    }
    if (right <= left) return compressVoucherImage(file);

    const padding = Math.max(3, Math.round(analysis.width * 0.008));
    const sourceX = Math.max(0, (left - padding) / analysisScale);
    const sourceY = Math.max(0, (card.top - padding) / analysisScale);
    const sourceRight = Math.min(image.naturalWidth, (right + padding) / analysisScale);
    const sourceBottom = Math.min(image.naturalHeight, (card.bottom + padding) / analysisScale);
    const sourceWidth = sourceRight - sourceX;
    const sourceHeight = sourceBottom - sourceY;
    const outputScale = Math.min(1, 1100 / sourceWidth);
    const output = document.createElement("canvas");
    output.width = Math.max(1, Math.round(sourceWidth * outputScale));
    output.height = Math.max(1, Math.round(sourceHeight * outputScale));
    const outputContext = output.getContext("2d");
    if (!outputContext) throw new Error("canvas unavailable");
    outputContext.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, output.width, output.height);
    return canvasToCompressedDataUrl(output);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function voucherTitle(type: VoucherType) {
  if (type === "5off25") return "€5 OFF €25";
  return type === "10off50" ? "€10 OFF €50" : "€10 OFF €40";
}

function voucherSpendThreshold(type: VoucherType) {
  if (type === "5off25") return 25;
  return type === "10off50" ? 50 : 40;
}

function parseReservedUntil(value: string | null) {
  if (!value) return null;
  const normalized = value.trim()
    .replace(" ", "T")
    .replace(/([+-]\d{2})$/, "$1:00")
    .replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatReservationTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainingSeconds = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

export default function DunnesPage() {
  const { t, language } = useLanguage();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [membershipUploading, setMembershipUploading] = useState(false);
  const [draftImage, setDraftImage] = useState<string | null>(null);
  const [draftType, setDraftType] = useState<VoucherType>("5off25");
  const [draftBarcode, setDraftBarcode] = useState("");
  const [draftExpiry, setDraftExpiry] = useState("");
  const [tenEuroSpend, setTenEuroSpend] = useState<40 | 50>(40);
  const [reservationsRemaining, setReservationsRemaining] = useState(3);
  const [membershipRequired, setMembershipRequired] = useState(false);
  const [membershipImage, setMembershipImage] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ voucherId: string; stage: "membership" | "voucher"; expiresAt: number } | null>(null);
  const [pendingReservationVoucherId, setPendingReservationVoucherId] = useState<string | null>(null);
  const [reportVoucherId, setReportVoucherId] = useState<string | null>(null);
  const [showSampleGuide, setShowSampleGuide] = useState(false);
  const [clock, setClock] = useState(() => Date.now());

  const available = useMemo(() => vouchers.filter((voucher) => voucher.status === "available" && !voucher.is_mine), [vouchers]);
  const busy = useMemo(() => vouchers.filter((voucher) => voucher.status === "reserved" && !voucher.is_mine && !voucher.reserved_by_me), [vouchers]);
  const reserved = useMemo(() => vouchers.filter((voucher) => voucher.status === "reserved" && voucher.reserved_by_me), [vouchers]);
  const mine = useMemo(() => vouchers.filter((voucher) => voucher.is_mine && voucher.status !== "used" && voucher.status !== "expired" && voucher.status !== "rejected"), [vouchers]);
  const pendingReservationVoucher = pendingReservationVoucherId ? available.find((voucher) => voucher.id === pendingReservationVoucherId) ?? null : null;
  const noticeRequiresAction = Boolean(notice && /(만료|이미 등록|먼저 예약|예약 3회|다시 확인|읽지 못|불러오지 못|올려 주세요|10MB|등록하지 못|등록 가능한|나눔 중|서버 응답)/.test(notice));
  const reservationUi = language === "en" ? {
    timerLabel: "Reservation time left",
    warningTitle: "Please check before reserving this voucher",
    minimumSpend: (threshold: number) => `Your basket total before the voucher is applied must be at least €${threshold}.`,
    membershipNote: "This voucher also requires the ValueClub Card to be scanned. Please meet the minimum spend so the member who shared it can receive their next discount voucher correctly.",
    standardNote: "Please make sure the minimum spend is met before presenting the voucher at checkout.",
    quotaNote: "Confirming this reservation will use 1 of your 3 daily reservations.",
    confirm: "I understand · reserve",
    expired: "This reservation has expired. Please reserve the voucher again.",
  } : language === "fa" ? {
    timerLabel: "زمان باقی‌مانده رزرو",
    warningTitle: "پیش از رزرو ووچر حتماً بررسی کنید",
    minimumSpend: (threshold: number) => `مبلغ سبد خرید قبل از اعمال ووچر باید حداقل €${threshold} باشد.`,
    membershipNote: "این ووچر نیاز به اسکن ValueClub Card نیز دارد. لطفاً حداقل خرید را رعایت کنید تا ووچر تخفیف بعدی برای عضوی که آن را به اشتراک گذاشته است به‌درستی ایجاد شود.",
    standardNote: "پیش از ارائه ووچر در صندوق، حتماً حداقل مبلغ خرید را رعایت کنید.",
    quotaNote: "با تأیید رزرو، ۱ مورد از ۳ رزرو روزانه شما استفاده می‌شود.",
    confirm: "متوجه شدم · رزرو",
    expired: "زمان این رزرو تمام شده است. لطفاً دوباره ووچر را رزرو کنید.",
  } : {
    timerLabel: "예약 남은 시간",
    warningTitle: "예약 전 꼭 확인해 주세요",
    minimumSpend: (threshold: number) => `이 바우처는 쿠폰 적용 전 결제 금액이 반드시 €${threshold} 이상이어야 합니다.`,
    membershipNote: "ValueClub Card를 함께 스캔하는 바우처입니다. 등록한 사용자에게 다음 할인 쿠폰이 정상적으로 다시 생성될 수 있도록 최소 구매금액 조건을 꼭 지켜 주세요.",
    standardNote: "계산대에서 바우처를 보여주기 전에 최소 구매금액 조건을 꼭 충족해 주세요.",
    quotaNote: "예약을 확정하면 오늘 예약 가능 횟수 3회 중 1회가 사용됩니다.",
    confirm: "확인하고 예약하기",
    expired: "예약 시간이 만료되었습니다. 다시 예약해 주세요.",
  };

  useEffect(() => {
    if (!notice || noticeRequiresAction) return;
    const timer = window.setTimeout(() => setNotice((current) => current === notice ? null : current), 3_000);
    return () => window.clearTimeout(timer);
  }, [notice, noticeRequiresAction]);

  async function loadVouchers() {
    try {
      const response = await fetch(`/api/dunnes-vouchers?deviceKey=${encodeURIComponent(getDeviceKey())}`, { cache: "no-store" });
      if (!response.ok) throw new Error("load failed");
      const result = await response.json() as { vouchers?: Voucher[]; reservationsRemaining?: number };
      setVouchers(result.vouchers ?? []);
      setReservationsRemaining(result.reservationsRemaining ?? 3);
    } catch {
      setNotice("목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initial = window.setTimeout(() => void loadVouchers(), 0);
    const timer = window.setInterval(() => void loadVouchers(), 15_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!reveal && reserved.length === 0) return;
    const tick = () => {
      const now = Date.now();
      setClock(now);
      if (reveal && now >= reveal.expiresAt) setReveal(null);
    };
    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [reveal, reserved.length]);

  const revealSeconds = reveal ? Math.max(0, Math.ceil((reveal.expiresAt - clock) / 1000)) : 0;

  function reservationSecondsLeft(voucher: Voucher) {
    const reservedUntil = parseReservedUntil(voucher.reserved_until);
    if (reservedUntil === null) return null;
    return Math.max(0, Math.ceil((reservedUntil - clock) / 1000));
  }

  function startReveal(voucher: Voucher, stage?: "membership" | "voucher") {
    const startedAt = new Date().getTime();
    setClock(startedAt);
    setReveal({ voucherId: voucher.id, stage: stage ?? (voucher.membership_required ? "membership" : "voucher"), expiresAt: startedAt + 30_000 });
    if (!stage) {
      void fetch("/api/dunnes-vouchers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "record_view", deviceKey: getDeviceKey(), voucherId: voucher.id }),
      });
    }
  }

  async function confirmReservation(voucher: Voucher) {
    setPendingReservationVoucherId(null);
    await runAction("reserve", voucher.id, "30분간 예약했습니다.");
  }

  async function act(action: string, voucherId?: string, extra: Record<string, unknown> = {}) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), action === "upload" ? UPLOAD_REQUEST_TIMEOUT_MS : REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch("/api/dunnes-vouchers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, deviceKey: getDeviceKey(), voucherId, ...extra }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw new Error("서버 응답이 늦습니다. 잠시 후 다시 시도해 주세요.");
      throw new Error("서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      window.clearTimeout(timeout);
    }
    const result = await response.json().catch(() => ({ error: response.status === 413 ? "request_too_large" : "unavailable" })) as { vouchers?: Voucher[]; reservationsRemaining?: number; error?: string };
    if (!response.ok) {
      const messages: Record<string, string> = {
        duplicate: "이미 등록된 바우처입니다.",
        expired: "이미 만료된 바우처입니다.",
        already_reserved: "다른 사람이 먼저 예약했습니다.",
        daily_reservation_limit: "오늘 예약 3회를 모두 사용했습니다.",
        invalid_voucher: "인식한 정보를 다시 확인해 주세요.",
        membership_image_required: "ValueClub Card 바코드 사진을 올려 주세요.",
        image_too_large: "바우처 사진 용량을 줄이지 못했습니다. 사진을 다시 선택해 주세요.",
        membership_image_too_large: "ValueClub Card 사진 용량을 줄이지 못했습니다. 사진을 다시 선택해 주세요.",
        request_too_large: "사진 용량이 너무 큽니다. 사진을 다시 선택해 주세요.",
        rate_limit: "오늘 등록 가능한 바우처 2개를 모두 등록했습니다.",
        voucher_limit: "내가 나눔 중인 바우처는 최대 5개까지 등록할 수 있습니다.",
        unavailable: "서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        report_unavailable: "현재 예약한 바우처만 신고할 수 있습니다.",
      };
      throw new Error(messages[result.error ?? ""] ?? "처리하지 못했습니다. 다시 시도해 주세요.");
    }
    setVouchers(result.vouchers ?? []);
    setReservationsRemaining(result.reservationsRemaining ?? reservationsRemaining);
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMembershipRequired(false);
    setMembershipImage(null);
    if (file.size > 10 * 1024 * 1024) {
      setNotice("사진은 10MB 이하로 올려 주세요.");
      return;
    }
    setUploading(true);
    setNotice("바우처 정보를 확인하고 있습니다.");
    setDraftImage(null);
    setDraftType("5off25");
    setDraftBarcode("");
    setDraftExpiry("");

    let imageData: string;
    try {
      imageData = await compressVoucherImage(file);
      setDraftImage(imageData);
    } catch {
      setNotice("사진을 읽지 못했습니다. 선명한 원본 화면으로 다시 시도해 주세요.");
      setUploading(false);
      return;
    }

    let worker: { recognize: (image: string) => Promise<{ data: { text: string } }>; terminate: () => Promise<unknown> } | null = null;
    try {
      const { createWorker } = await withTimeout(import("tesseract.js"), OCR_TIMEOUT_MS);
      worker = await withTimeout(createWorker("eng"), OCR_TIMEOUT_MS);
      const { data } = await withTimeout(worker.recognize(imageData), OCR_TIMEOUT_MS);
      const recognizedExpiry = parseExpiry(data.text);
      if (recognizedExpiry && recognizedExpiry < todayInDublin()) {
        setDraftImage(null);
        setDraftBarcode("");
        setDraftExpiry("");
        setNotice("이미 만료된 바우처입니다.");
        return;
      }
      const recognizedType = parseVoucherType(data.text);
      if (recognizedType) setDraftType(recognizedType);
      setDraftBarcode(parseBarcode(data.text));
      setDraftExpiry(recognizedExpiry);
      setNotice("인식 결과를 확인한 뒤 등록해 주세요.");
    } catch {
      setNotice("종류, 바코드 번호, 만료일을 모두 확인해 주세요.");
    } finally {
      setUploading(false);
      if (worker) void worker.terminate().catch(() => undefined);
    }
  }

  async function submitDraft() {
    if (uploading || membershipUploading) return;
    if (!draftImage || !draftBarcode || !draftExpiry) {
      setNotice("종류, 바코드 번호, 만료일을 모두 확인해 주세요.");
      return;
    }
    if (membershipRequired && !membershipImage) {
      setNotice("ValueClub Card 바코드 사진을 올려 주세요.");
      return;
    }
    setUploading(true);
    try {
      await act("upload", undefined, { voucherType: draftType, barcode: draftBarcode, imageData: draftImage, membershipRequired, membershipImageData: membershipImage, expiresOn: draftExpiry });
      setDraftImage(null);
      setDraftBarcode("");
      setDraftExpiry("");
      setMembershipRequired(false);
      setMembershipImage(null);
      setNotice("무료 나눔 목록에 등록했습니다.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "등록하지 못했습니다.";
      if (message === "이미 만료된 바우처입니다.") setDraftImage(null);
      setNotice(message);
    } finally {
      setUploading(false);
    }
  }

  async function handleMembershipUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setNotice("사진은 10MB 이하로 올려 주세요.");
      return;
    }
    setMembershipUploading(true);
    setMembershipImage(null);
    try {
      setMembershipImage(await cropValueClubCard(file));
      setNotice("초록색 ValueClub Card 영역만 잘라서 추가했습니다.");
    } catch {
      setNotice("ValueClub Card 사진을 읽지 못했습니다.");
    } finally {
      setMembershipUploading(false);
    }
  }

  async function runAction(action: string, id: string, success: string) {
    try {
      await act(action, id);
      if (action === "mark_used" || action === "cancel_reservation") {
        setReveal(null);
        setPendingReservationVoucherId(null);
      }
      setNotice(success);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "처리하지 못했습니다.");
    }
  }

  async function submitReport(voucherId: string, reason: "invalid_voucher" | "membership_not_scanned") {
    try {
      await act("report", voucherId, { reason });
      setReportVoucherId(null);
      setNotice(reason === "invalid_voucher"
        ? "유효하지 않은 바우처로 신고했습니다. 관리자가 확인합니다."
        : "멤버십 스캔 누락으로 신고했습니다. 관리자가 확인합니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "신고하지 못했습니다.");
    }
  }

  return (
    <main className="dunnes-shell">
      <IosInAppBrowserNotice />
      <header className="dunnes-topbar">
        <Link className="brand" href="/"><span className="brand-mark">C</span><span>CouponShare</span></Link>
        <button className="dunnes-home" type="button" onClick={() => window.location.assign("/")}>{t("메인으로")}</button>
      </header>

      <section className="dunnes-hero">
        <div><p className="eyebrow">DUNNES FREE SHARE</p><h1>{t("Dunnes 바우처 무료 나눔")}</h1><p>{t("필요한 바우처를 30분간 예약하고 매장에서 사용하세요.")}</p></div>
        <div className="dunnes-hero-actions"><span>{t("오늘 예약")} {reservationsRemaining}/3 {t("회 남음")}</span><button className={styles.sampleGuideButton} type="button" onClick={() => setShowSampleGuide((current) => !current)}><b aria-hidden="true">?</b><span>{t("샘플 쿠폰 이용 방법")}</span><i aria-hidden="true">→</i></button><label className="dunnes-upload"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleUpload} disabled={uploading} /><span>＋</span>{uploading ? t("확인 중") : t("바우처 등록")}</label></div>
      </section>

      {showSampleGuide && <section className="dunnes-guide" aria-label={t("샘플 쿠폰 이용 방법")}>
        <header className="dunnes-guide-head"><div><p className="eyebrow">HOW TO USE</p><h2>{t("샘플 쿠폰 이용 방법")}</h2></div><button type="button" onClick={() => setShowSampleGuide(false)}>{t("닫기")}</button></header>
        <div className="dunnes-guide-grid">
          <article><span className="dunnes-membership-badge required">{t("멤버십 스캔 필요")}</span><ol><li><strong>{t("ValueClub Card를 먼저 스캔")}</strong><small>{t("멤버십 바코드를 계산대에 먼저 보여주세요.")}</small></li><li><strong>{t("할인 바우처를 이어서 스캔")}</strong><small>{t("그다음 €5 또는 €10 할인 바우처를 보여주세요.")}</small></li></ol></article>
          <article><span className="dunnes-membership-badge">{t("멤버십 불필요")}</span><ol><li><strong>{t("할인 바우처만 스캔")}</strong><small>{t("€5 또는 €10 할인 바우처를 바로 보여주세요.")}</small></li></ol></article>
        </div>
      </section>}

      {notice && <div className={noticeRequiresAction ? "dunnes-notice danger" : "dunnes-notice"} role={noticeRequiresAction ? "alert" : "status"}><span>{noticeRequiresAction && <b aria-hidden="true">!</b>}{t(notice)}</span><button type="button" onClick={() => setNotice(null)}>{t("닫기")}</button></div>}

      {pendingReservationVoucher && (
        <div className={styles.warningBackdrop} role="presentation" onMouseDown={() => setPendingReservationVoucherId(null)}>
          <section className={styles.warningDialog} role="dialog" aria-modal="true" aria-labelledby="dunnes-reservation-warning-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className={styles.warningIcon} aria-hidden="true">!</div>
            <p className="eyebrow">BEFORE RESERVING</p>
            <h2 id="dunnes-reservation-warning-title">{reservationUi.warningTitle}</h2>
            <strong className={styles.warningSpend}>{reservationUi.minimumSpend(voucherSpendThreshold(pendingReservationVoucher.voucher_type))}</strong>
            <p>{pendingReservationVoucher.membership_required ? reservationUi.membershipNote : reservationUi.standardNote}</p>
            <p><strong>{reservationUi.quotaNote}</strong></p>
            <div className={styles.warningActions}>
              <button type="button" className="secondary" onClick={() => setPendingReservationVoucherId(null)}>{t("취소")}</button>
              <button type="button" onClick={() => void confirmReservation(pendingReservationVoucher)}>{reservationUi.confirm}</button>
            </div>
          </section>
        </div>
      )}

      {draftImage && (
        <section className="dunnes-draft">
          <img src={draftImage} alt="등록할 Dunnes 바우처" />
          <div>
            <h2>{t("등록 정보 확인")}</h2>
            <label>{t("바우처")}<select value={draftType} onChange={(event) => setDraftType(event.target.value as VoucherType)}><option value="5off25">€5 OFF €25</option><option value="10off40">€10 OFF €40</option><option value="10off50">€10 OFF €50</option></select></label>
            <label>{t("바코드 번호")}<input inputMode="numeric" value={draftBarcode} onChange={(event) => setDraftBarcode(event.target.value.replace(/\D/g, "").slice(0, 16))} placeholder={t("바코드 아래 숫자")} /></label>
            <label>{t("만료일")}<input type="date" value={draftExpiry} onChange={(event) => setDraftExpiry(event.target.value)} /></label>
            <label className="dunnes-membership-check"><span><input type="checkbox" checked={membershipRequired} onChange={(event) => { setMembershipRequired(event.target.checked); if (!event.target.checked) setMembershipImage(null); }} />{t("멤버십 스캔 필요")}</span></label>
            {membershipRequired && <label className="dunnes-membership-upload">{t("ValueClub Card 바코드 사진 · 초록색 박스만 자동 자르기")}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleMembershipUpload} disabled={membershipUploading || uploading} />{membershipImage ? <img src={membershipImage} alt="ValueClub Card barcode" /> : <span>{membershipUploading ? t("사진 처리 중…") : t("사진 선택")}</span>}</label>}
            <div className="dunnes-draft-actions"><button type="button" onClick={submitDraft} disabled={uploading || membershipUploading}>{membershipUploading ? t("사진 처리 중…") : uploading ? t("등록 중…") : t("무료 나눔 등록")}</button><button type="button" className="secondary" onClick={() => { setDraftImage(null); setMembershipRequired(false); setMembershipImage(null); }} disabled={uploading || membershipUploading}>{t("취소")}</button></div>
          </div>
        </section>
      )}

      {reserved.length > 0 && (
        <section className="dunnes-reserved">
          <div className="dunnes-section-head"><div><p className="eyebrow">MY RESERVATION</p><h2>{t("내가 예약한 바우처")}</h2></div><span>{t("30분 보관")}</span></div>
          <div className="dunnes-reserved-grid">{reserved.map((voucher) => {
            const secondsLeft = reservationSecondsLeft(voucher);
            const reservationExpired = secondsLeft !== null && secondsLeft <= 0;
            return (
              <article key={voucher.id}>
                <div className="dunnes-voucher-heading"><span className={voucher.membership_required ? "dunnes-membership-badge required" : "dunnes-membership-badge"}>{voucher.membership_required ? t("멤버십 스캔") : t("멤버십 불필요")}</span><strong>{voucherTitle(voucher.voucher_type)}</strong><span>{voucher.expires_on} {t("만료")}</span></div>
                <div className={styles.reservationTimer} role="timer" aria-live="off"><span>{reservationUi.timerLabel}</span><strong>{secondsLeft === null ? "--:--" : formatReservationTime(secondsLeft)}</strong></div>
                {reveal?.voucherId === voucher.id && reveal.stage === "membership" && voucher.membership_image_data && <div className="dunnes-reveal"><b>ValueClub Card · {revealSeconds}s</b><img src={voucher.membership_image_data} alt="ValueClub Card barcode" draggable={false} /><button type="button" onClick={() => startReveal(voucher, "voucher")}>{t("멤버십 스캔 완료 → 바우처 보기")}</button></div>}
                {reveal?.voucherId === voucher.id && reveal.stage === "voucher" && voucher.image_data && <div className="dunnes-reveal"><b>{t("바우처")} · {revealSeconds}s</b><img src={voucher.image_data} alt={`${voucherTitle(voucher.voucher_type)} voucher`} draggable={false} /><label className="dunnes-used-check"><input type="checkbox" onChange={() => runAction("mark_used", voucher.id, "✓ 사용 완료 처리했습니다.")} /><span>{t("✓ 사용 완료")}</span></label></div>}
                {reveal?.voucherId !== voucher.id && <button type="button" disabled={reservationExpired} onClick={() => startReveal(voucher)}>{reservationExpired ? reservationUi.expired : voucher.membership_required ? t("ValueClub Card 보기 (30초)") : t("바우처 보기 (30초)")}</button>}
                <button type="button" className="secondary" onClick={() => runAction("cancel_reservation", voucher.id, "예약을 취소했습니다.")}>{t("예약 취소")}</button>
                {reportVoucherId === voucher.id ? <div className="dunnes-report-actions" role="group" aria-label={t("무엇이 문제였나요?")}><strong>{t("무엇이 문제였나요?")}</strong><button type="button" onClick={() => submitReport(voucher.id, "invalid_voucher")}>{t("바우처가 유효하지 않음")}</button><button type="button" onClick={() => submitReport(voucher.id, "membership_not_scanned")}>{t("멤버십 스캔 누락")}</button><button type="button" className="secondary" onClick={() => setReportVoucherId(null)}>{t("취소")}</button></div> : <button type="button" className="dunnes-report-button" onClick={() => setReportVoucherId(voucher.id)}>{t("문제 신고")}</button>}
              </article>
            );
          })}</div>
        </section>
      )}

      <section className="dunnes-market" aria-busy={loading}>
        {(["5off25", tenEuroSpend === 40 ? "10off40" : "10off50"] as VoucherType[]).map((type) => {
          const isTenEuro = type !== "5off25";
          const sectionVouchers = available.filter((voucher) => voucher.voucher_type === type);
          const busyVouchers = busy.filter((voucher) => voucher.voucher_type === type);
          const myVouchers = mine.filter((voucher) => voucher.voucher_type === type);
          const totalTenEuro = [...available, ...busy, ...mine].filter((voucher) => voucher.voucher_type === "10off40" || voucher.voucher_type === "10off50").length;
          return <article className="dunnes-column" key={isTenEuro ? "ten-euro" : type}>
            <header><div><strong>{isTenEuro ? t("€10 할인") : t("€5 할인")}</strong><span>{isTenEuro ? t("구매 조건을 선택하세요") : t("€25 이상 구매")}</span></div><b>{isTenEuro ? totalTenEuro : sectionVouchers.length + busyVouchers.length + myVouchers.length}</b></header>
            {isTenEuro && <div className="dunnes-threshold-tabs" role="tablist" aria-label={t("구매 조건을 선택하세요")}><button className={tenEuroSpend === 40 ? "active" : ""} type="button" role="tab" aria-selected={tenEuroSpend === 40} onClick={() => setTenEuroSpend(40)}>{t("€40 이상")}</button><button className={tenEuroSpend === 50 ? "active" : ""} type="button" role="tab" aria-selected={tenEuroSpend === 50} onClick={() => setTenEuroSpend(50)}>{t("€50 이상")}</button></div>}
            <div className="dunnes-list">
              {myVouchers.map((voucher) => <div className="dunnes-list-item mine" key={voucher.id}><div><span className={voucher.membership_required ? "dunnes-membership-badge required" : "dunnes-membership-badge"}>{voucher.membership_required ? t("멤버십 스캔") : t("멤버십 불필요")}</span><strong>{voucherTitle(type)}</strong><span>{voucher.expires_on} {t("만료")} · {voucher.review_status === "pending" ? t("관리자 검수 중") : voucher.status === "reserved" ? t("다른 사용자가 이용 중") : t("내가 등록한 바우처")}</span></div><button type="button" disabled>{voucher.review_status === "pending" ? t("검수 중") : voucher.status === "reserved" ? t("이용 중") : t("내 바우처")}</button></div>)}
              {sectionVouchers.map((voucher) => <div className="dunnes-list-item" key={voucher.id}><div><span className={voucher.membership_required ? "dunnes-membership-badge required" : "dunnes-membership-badge"}>{voucher.membership_required ? t("멤버십 스캔") : t("멤버십 불필요")}</span><strong>{voucherTitle(type)}</strong><span>{voucher.expires_on} {t("만료")} · {voucher.barcode_masked}</span></div><button type="button" disabled={reservationsRemaining <= 0} onClick={() => setPendingReservationVoucherId(voucher.id)}>{reservationsRemaining > 0 ? t("예약") : t("오늘 예약 완료")}</button></div>)}
              {busyVouchers.map((voucher) => <div className="dunnes-list-item busy" key={voucher.id}><div><strong>{voucherTitle(type)}</strong><span>{voucher.expires_on} {t("만료")} · {t("다른 사용자가 확인 중")}</span></div><button type="button" disabled>{t("이용 중")}</button></div>)}
              {!myVouchers.length && !sectionVouchers.length && !busyVouchers.length && <p>{loading ? t("불러오는 중") : t("현재 나눔 가능한 바우처가 없습니다.")}</p>}
            </div>
          </article>;
        })}
      </section>

      {mine.length > 0 && <details className="dunnes-mine"><summary>{t("내가 나눔한 바우처")} {mine.length}</summary><div>{mine.map((voucher) => <article key={voucher.id}><span><strong>{voucherTitle(voucher.voucher_type)}</strong>{voucher.status === "reserved" ? t("예약됨") : t("나눔 중")} · {voucher.expires_on} {t("만료")}</span><button type="button" onClick={() => runAction("delete", voucher.id, "나눔 목록에서 삭제했습니다.")}>{t("삭제")}</button></article>)}</div></details>}
      <PolicyLinks />
    </main>
  );
}

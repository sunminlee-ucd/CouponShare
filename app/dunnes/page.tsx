"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import IosInAppBrowserNotice from "../IosInAppBrowserNotice";

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
  is_mine: boolean;
  reserved_by_me: boolean;
  reserved_until: string | null;
};

const DEVICE_KEY_STORAGE_KEY = "couponshare-device-key-v2";

function getDeviceKey() {
  const saved = localStorage.getItem(DEVICE_KEY_STORAGE_KEY);
  if (saved) return saved;
  const created = crypto.randomUUID();
  localStorage.setItem(DEVICE_KEY_STORAGE_KEY, created);
  return created;
}

function parseExpiry(text: string) {
  const match = text.toUpperCase().match(/VALID\s+\d{1,2}\s+[A-Z]{3}\s*[-–]\s*(\d{1,2})\s+([A-Z]{3})/);
  if (!match) return "";
  const months: Record<string, number> = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
  const month = months[match[2]];
  if (month === undefined) return "";
  const now = new Date();
  let result = new Date(Date.UTC(now.getUTCFullYear(), month, Number(match[1])));
  if (result.getTime() < now.getTime() - 45 * 24 * 60 * 60 * 1000) {
    result = new Date(Date.UTC(now.getUTCFullYear() + 1, month, Number(match[1])));
  }
  return result.toISOString().slice(0, 10);
}

function parseBarcode(text: string) {
  return (text.match(/(?:\d[\s-]*){10,16}/g) ?? [])
    .map((value) => value.replace(/\D/g, ""))
    .filter((value) => value.length >= 10 && value.length <= 16)
    .sort((a, b) => b.length - a.length)[0] ?? "";
}

function todayInDublin() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin" }).format(new Date());
}

async function compressVoucherImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 1100 / image.naturalWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas unavailable");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.88);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function voucherTitle(type: VoucherType) {
  if (type === "5off25") return "€5 OFF €25";
  return type === "10off50" ? "€10 OFF €50" : "€10 OFF €40";
}

export default function DunnesPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [draftImage, setDraftImage] = useState<string | null>(null);
  const [draftType, setDraftType] = useState<VoucherType>("5off25");
  const [draftBarcode, setDraftBarcode] = useState("");
  const [draftExpiry, setDraftExpiry] = useState("");
  const [tenEuroSpend, setTenEuroSpend] = useState<40 | 50>(40);
  const [reservationsRemaining, setReservationsRemaining] = useState(3);
  const [membershipRequired, setMembershipRequired] = useState(false);
  const [membershipImage, setMembershipImage] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ voucherId: string; stage: "membership" | "voucher"; expiresAt: number } | null>(null);
  const [clock, setClock] = useState(() => Date.now());

  const available = useMemo(() => vouchers.filter((voucher) => voucher.status === "available" && !voucher.is_mine), [vouchers]);
  const busy = useMemo(() => vouchers.filter((voucher) => voucher.status === "reserved" && !voucher.is_mine && !voucher.reserved_by_me), [vouchers]);
  const reserved = useMemo(() => vouchers.filter((voucher) => voucher.status === "reserved" && voucher.reserved_by_me), [vouchers]);
  const mine = useMemo(() => vouchers.filter((voucher) => voucher.is_mine && voucher.status !== "used" && voucher.status !== "expired" && voucher.status !== "rejected"), [vouchers]);
  const noticeRequiresAction = Boolean(notice && /(만료|이미 등록|먼저 예약|예약 3회|다시 확인|읽지 못|불러오지 못|올려 주세요|10MB)/.test(notice));

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
    void loadVouchers();
    const timer = window.setInterval(() => void loadVouchers(), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!reveal) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setClock(now);
      if (now >= reveal.expiresAt) setReveal(null);
    }, 500);
    return () => window.clearInterval(timer);
  }, [reveal]);

  const revealSeconds = reveal ? Math.max(0, Math.ceil((reveal.expiresAt - clock) / 1000)) : 0;

  function startReveal(voucher: Voucher, stage?: "membership" | "voucher") {
    setClock(Date.now());
    setReveal({ voucherId: voucher.id, stage: stage ?? (voucher.membership_required ? "membership" : "voucher"), expiresAt: Date.now() + 30_000 });
  }

  async function act(action: string, voucherId?: string, extra: Record<string, unknown> = {}) {
    const response = await fetch("/api/dunnes-vouchers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, deviceKey: getDeviceKey(), voucherId, ...extra }),
    });
    const result = await response.json() as { vouchers?: Voucher[]; reservationsRemaining?: number; error?: string };
    if (!response.ok) {
      const messages: Record<string, string> = {
        duplicate: "이미 등록된 바우처입니다.",
        expired: "이미 만료된 바우처입니다.",
        already_reserved: "다른 사람이 먼저 예약했습니다.",
        daily_reservation_limit: "오늘 예약 3회를 모두 사용했습니다.",
        invalid_voucher: "인식한 정보를 다시 확인해 주세요.",
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
    let worker: { recognize: (image: File) => Promise<{ data: { text: string } }>; terminate: () => Promise<unknown> } | null = null;
    try {
      const [{ createWorker }, imageData] = await Promise.all([import("tesseract.js"), compressVoucherImage(file)]);
      worker = await createWorker("eng");
      const { data } = await worker.recognize(file);
      const upper = data.text.toUpperCase();
      const recognizedExpiry = parseExpiry(data.text);
      if (recognizedExpiry && recognizedExpiry < todayInDublin()) {
        setDraftImage(null);
        setDraftBarcode("");
        setDraftExpiry("");
        setNotice("이미 만료된 바우처입니다.");
        return;
      }
      setDraftImage(imageData);
      setDraftType(upper.includes("10 OFF") || upper.includes("€10")
        ? upper.includes("50") ? "10off50" : "10off40"
        : "5off25");
      setDraftBarcode(parseBarcode(data.text));
      setDraftExpiry(recognizedExpiry);
      setNotice("인식 결과를 확인한 뒤 등록해 주세요.");
    } catch {
      setNotice("사진을 읽지 못했습니다. 선명한 원본 화면으로 다시 시도해 주세요.");
    } finally {
      await worker?.terminate();
      setUploading(false);
    }
  }

  async function submitDraft() {
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
    try {
      setMembershipImage(await compressVoucherImage(file));
      setNotice("ValueClub Card 바코드 사진을 추가했습니다.");
    } catch {
      setNotice("ValueClub Card 사진을 읽지 못했습니다.");
    }
  }

  async function runAction(action: string, id: string, success: string) {
    try {
      await act(action, id);
      if (action === "mark_used" || action === "cancel_reservation") setReveal(null);
      setNotice(success);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "처리하지 못했습니다.");
    }
  }

  return (
    <main className="dunnes-shell">
      <IosInAppBrowserNotice />
      <header className="dunnes-topbar">
        <a className="brand" href="/"><span className="brand-mark">C</span><span>CouponShare</span></a>
        <a className="dunnes-home" href="/">메인으로</a>
      </header>

      <section className="dunnes-hero">
        <div><p className="eyebrow">DUNNES FREE SHARE</p><h1>Dunnes 바우처 무료 나눔</h1><p>필요한 바우처를 30분간 예약하고 매장에서 사용하세요.</p></div>
        <div className="dunnes-hero-actions"><span>오늘 예약 {reservationsRemaining}/3회 남음</span><label className="dunnes-upload"><input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} /><span>＋</span>{uploading ? "확인 중" : "바우처 등록"}</label></div>
      </section>

      {notice && <div className={noticeRequiresAction ? "dunnes-notice danger" : "dunnes-notice"} role={noticeRequiresAction ? "alert" : "status"}><span>{noticeRequiresAction && <b aria-hidden="true">!</b>}{notice}</span><button type="button" onClick={() => setNotice(null)}>닫기</button></div>}

      {draftImage && (
        <section className="dunnes-draft">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={draftImage} alt="등록할 Dunnes 바우처" />
          <div>
            <h2>등록 정보 확인</h2>
            <label>바코드 번호<input inputMode="numeric" value={draftBarcode} onChange={(event) => setDraftBarcode(event.target.value.replace(/\D/g, "").slice(0, 16))} placeholder="바코드 아래 숫자" /></label>
            <label>만료일<input type="date" value={draftExpiry} onChange={(event) => setDraftExpiry(event.target.value)} /></label>
            <label className="dunnes-membership-check"><span><input type="checkbox" checked={membershipRequired} onChange={(event) => { setMembershipRequired(event.target.checked); if (!event.target.checked) setMembershipImage(null); }} />멤버십 스캔 필요</span></label>
            {membershipRequired && <label className="dunnes-membership-upload">ValueClub Card 바코드 사진<input type="file" accept="image/*" onChange={handleMembershipUpload} />{membershipImage ? <img src={membershipImage} alt="등록할 ValueClub Card 바코드" /> : <span>사진 선택</span>}</label>}
            <div className="dunnes-draft-actions"><button type="button" onClick={submitDraft} disabled={uploading}>무료 나눔 등록</button><button type="button" className="secondary" onClick={() => { setDraftImage(null); setMembershipRequired(false); setMembershipImage(null); }}>취소</button></div>
          </div>
        </section>
      )}

      {reserved.length > 0 && (
        <section className="dunnes-reserved">
          <div className="dunnes-section-head"><div><p className="eyebrow">MY RESERVATION</p><h2>내가 예약한 바우처</h2></div><span>30분 보관</span></div>
          <div className="dunnes-reserved-grid">{reserved.map((voucher) => (
            <article key={voucher.id}>
              <div className="dunnes-voucher-heading"><span className={voucher.membership_required ? "dunnes-membership-badge required" : "dunnes-membership-badge"}>{voucher.membership_required ? "멤버십 스캔" : "멤버십 불필요"}</span><strong>{voucherTitle(voucher.voucher_type)}</strong><span>{voucher.expires_on} 만료</span></div>
              {reveal?.voucherId === voucher.id && reveal.stage === "membership" && voucher.membership_image_data && <div className="dunnes-reveal"><b>ValueClub Card · {revealSeconds}초</b><img src={voucher.membership_image_data} alt="ValueClub Card 바코드" draggable={false} /><button type="button" onClick={() => startReveal(voucher, "voucher")}>멤버십 스캔 완료 → 바우처 보기</button></div>}
              {reveal?.voucherId === voucher.id && reveal.stage === "voucher" && voucher.image_data && <div className="dunnes-reveal"><b>바우처 · {revealSeconds}초</b><img src={voucher.image_data} alt={`${voucherTitle(voucher.voucher_type)} 바우처`} draggable={false} /><label className="dunnes-used-check"><input type="checkbox" onChange={() => runAction("mark_used", voucher.id, "✓ 사용 완료 처리했습니다.")} /><span>✓ 사용 완료</span></label></div>}
              {reveal?.voucherId !== voucher.id && <button type="button" onClick={() => startReveal(voucher)}>{voucher.membership_required ? "ValueClub Card 보기 (30초)" : "바우처 보기 (30초)"}</button>}
              <button type="button" className="secondary" onClick={() => runAction("cancel_reservation", voucher.id, "예약을 취소했습니다.")}>예약 취소</button>
            </article>
          ))}</div>
        </section>
      )}

      <section className="dunnes-market" aria-busy={loading}>
        {(["5off25", tenEuroSpend === 40 ? "10off40" : "10off50"] as VoucherType[]).map((type) => {
          const isTenEuro = type !== "5off25";
          const sectionVouchers = available.filter((voucher) => voucher.voucher_type === type);
          const busyVouchers = busy.filter((voucher) => voucher.voucher_type === type);
          const totalTenEuro = available.filter((voucher) => voucher.voucher_type === "10off40" || voucher.voucher_type === "10off50").length;
          return <article className="dunnes-column" key={isTenEuro ? "ten-euro" : type}>
            <header><div><strong>{isTenEuro ? "€10 할인" : "€5 할인"}</strong><span>{isTenEuro ? "구매 조건을 선택하세요" : "€25 이상 구매"}</span></div><b>{isTenEuro ? totalTenEuro : sectionVouchers.length}</b></header>
            {isTenEuro && <div className="dunnes-threshold-tabs" role="tablist" aria-label="€10 할인 구매 조건"><button className={tenEuroSpend === 40 ? "active" : ""} type="button" role="tab" aria-selected={tenEuroSpend === 40} onClick={() => setTenEuroSpend(40)}>€40 이상</button><button className={tenEuroSpend === 50 ? "active" : ""} type="button" role="tab" aria-selected={tenEuroSpend === 50} onClick={() => setTenEuroSpend(50)}>€50 이상</button></div>}
            <div className="dunnes-list">
              {sectionVouchers.map((voucher) => <div className="dunnes-list-item" key={voucher.id}><div><span className={voucher.membership_required ? "dunnes-membership-badge required" : "dunnes-membership-badge"}>{voucher.membership_required ? "멤버십 스캔" : "멤버십 불필요"}</span><strong>{voucherTitle(type)}</strong><span>{voucher.expires_on} 만료 · {voucher.barcode_masked}</span></div><button type="button" disabled={reservationsRemaining <= 0} onClick={() => runAction("reserve", voucher.id, "30분간 예약했습니다.")}>{reservationsRemaining > 0 ? "예약" : "오늘 예약 완료"}</button></div>)}
              {busyVouchers.map((voucher) => <div className="dunnes-list-item busy" key={voucher.id}><div><strong>{voucherTitle(type)}</strong><span>{voucher.expires_on} 만료 · 다른 사용자가 확인 중</span></div><button type="button" disabled>이용 중</button></div>)}
              {!sectionVouchers.length && !busyVouchers.length && <p>{loading ? "불러오는 중" : "현재 나눔 가능한 바우처가 없습니다."}</p>}
            </div>
          </article>;
        })}
      </section>

      {mine.length > 0 && <details className="dunnes-mine"><summary>내가 나눔한 바우처 {mine.length}개</summary><div>{mine.map((voucher) => <article key={voucher.id}><span><strong>{voucherTitle(voucher.voucher_type)}</strong>{voucher.status === "reserved" ? "예약됨" : "나눔 중"} · {voucher.expires_on} 만료</span><button type="button" onClick={() => runAction("delete", voucher.id, "나눔 목록에서 삭제했습니다.")}>삭제</button></article>)}</div></details>}
    </main>
  );
}

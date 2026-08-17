"use client";

import Link from "next/link";
import { useState } from "react";
import PolicyLinks from "@/app/PolicyLinks";
import { useLanguage } from "@/app/i18n";

const DEVICE_KEY_STORAGE_KEY = "couponshare-device-key-v2";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function SettingsPage() {
  const { t } = useLanguage();
  const [recoveryCode, setRecoveryCode] = useState("");
  const [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState(false);

  function currentDeviceKey() {
    const saved = localStorage.getItem(DEVICE_KEY_STORAGE_KEY);
    if (saved && uuidPattern.test(saved)) return saved;
    const created = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY_STORAGE_KEY, created);
    return created;
  }

  async function copyRecoveryCode() {
    const code = currentDeviceKey();
    await navigator.clipboard.writeText(code);
    setMessage("복구코드를 복사했습니다. 본인만 접근할 수 있는 곳에 보관해 주세요.");
  }

  function restoreDevice() {
    const normalized = recoveryCode.trim();
    if (!uuidPattern.test(normalized)) {
      setMessage("복구코드 형식을 확인해 주세요.");
      return;
    }
    localStorage.setItem(DEVICE_KEY_STORAGE_KEY, normalized);
    setMessage("복구했습니다. 메인 화면으로 이동합니다.");
    window.setTimeout(() => location.assign("/"), 700);
  }

  async function downloadData() {
    const response = await fetch(`/api/account?deviceKey=${encodeURIComponent(currentDeviceKey())}`, { cache: "no-store" });
    if (!response.ok) {
      setMessage("데이터를 준비하지 못했습니다.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `couponshare-data-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAccount() {
    if (!confirm(t("내 쿠폰, 바우처와 사용 기록을 모두 삭제할까요? 복구할 수 없습니다."))) return;
    setDeleting(true);
    const response = await fetch("/api/account", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceKey: currentDeviceKey(), confirmation: "DELETE" }),
    });
    if (!response.ok) {
      setMessage("삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setDeleting(false);
      return;
    }
    localStorage.removeItem(DEVICE_KEY_STORAGE_KEY);
    await fetch("/api/access", { method: "DELETE" });
    location.assign("/access");
  }

  return (
    <main className="settings-shell">
      <header className="settings-header"><Link className="brand" href="/"><span className="brand-mark">C</span><span>CouponShare</span></Link><Link href="/">{t("메인으로")}</Link></header>
      <section className="settings-card">
        <p className="eyebrow">MY DATA</p><h1>{t("내 정보 관리")}</h1>
        <article><h2>{t("기기 변경 대비")}</h2><p>{t("복구코드를 저장하면 다른 기기에서 기존 쿠폰과 기록을 다시 불러올 수 있습니다. 복구코드는 비밀번호처럼 보호해 주세요.")}</p><button type="button" onClick={copyRecoveryCode}>{t("복구코드 복사")}</button></article>
        <article><h2>{t("기존 정보 복구")}</h2><label htmlFor="recovery-code">{t("복구코드")}</label><input id="recovery-code" value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} /><button type="button" onClick={restoreDevice}>{t("이 기기에서 복구")}</button></article>
        <article><h2>{t("데이터 다운로드")}</h2><p>{t("현재 저장된 쿠폰·바우처·이용 기록을 JSON 파일로 받을 수 있습니다.")}</p><button type="button" onClick={downloadData}>{t("내 데이터 다운로드")}</button></article>
        <article className="settings-danger"><h2>{t("모든 데이터 삭제")}</h2><p>{t("내 프로필과 연결된 쿠폰·예약·사용 기록을 즉시 삭제합니다.")}</p><button type="button" onClick={deleteAccount} disabled={deleting}>{t(deleting ? "삭제 중…" : "내 데이터 모두 삭제")}</button></article>
        {message && <p className="settings-message" role="status">{t(message)}</p>}
      </section>
      <PolicyLinks settings={false} />
    </main>
  );
}

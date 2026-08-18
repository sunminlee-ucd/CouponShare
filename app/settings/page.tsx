"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PolicyLinks from "@/app/PolicyLinks";
import { useLanguage } from "@/app/i18n";

type AuthStatus = {
  authenticated: boolean;
  email?: string | null;
  provider?: string | null;
};

export default function SettingsPage() {
  const { t } = useLanguage();
  const [account, setAccount] = useState<AuthStatus | null>(null);
  const [message, setMessage] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/status", { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => response.ok ? response.json() as Promise<AuthStatus> : null)
      .then((status) => {
        if (!active || !status) return;
        if (!status.authenticated) {
          window.location.assign("/login?returnTo=%2Fsettings");
          return;
        }
        setAccount(status);
      })
      .catch(() => {
        if (active) setMessage("계정 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      });
    return () => { active = false; };
  }, []);

  async function downloadData() {
    setDownloading(true);
    setMessage("");
    try {
      const response = await fetch("/api/account", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("download_failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `couponshare-data-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("내 계정 데이터를 준비했습니다.");
    } catch {
      setMessage("데이터를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setDownloading(false);
    }
  }

  async function deleteAccount() {
    if (!confirm(t("CouponShare 계정과 연결된 바우처, 예약, 사용 기록을 모두 삭제할까요? 이 작업은 복구할 수 없습니다."))) return;
    setDeleting(true);
    setMessage("");
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ confirmation: "DELETE" }),
      });
      if (!response.ok) throw new Error("delete_failed");
      localStorage.removeItem("couponshare-device-key-v2");
      window.location.assign("/login");
    } catch {
      setMessage("계정을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setDeleting(false);
    }
  }

  const provider = account?.provider === "google" ? "Google" : account?.provider ? "Email" : "확인 중";

  return (
    <main className="settings-shell">
      <header className="settings-header">
        <Link className="brand" href="/"><span className="brand-mark">C</span><span>CouponShare</span></Link>
        <Link href="/profile">{t("프로필 설정")}</Link>
      </header>
      <section className="settings-card">
        <p className="eyebrow">MY DATA</p>
        <h1>{t("내 정보 관리")}</h1>
        <article>
          <h2>{t("현재 계정")}</h2>
          <p>{account?.email ?? t("계정 정보를 확인하고 있습니다.")} {account?.authenticated ? `· ${provider}` : ""}</p>
          <Link href="/profile">{t("로그인 및 자동 로그인 설정 보기")}</Link>
        </article>
        <article>
          <h2>{t("데이터 다운로드")}</h2>
          <p>{t("현재 계정에 저장된 바우처, 예약 및 이용 기록을 JSON 파일로 받을 수 있습니다.")}</p>
          <button type="button" onClick={downloadData} disabled={downloading || deleting}>
            {t(downloading ? "준비 중…" : "내 데이터 다운로드")}
          </button>
        </article>
        <article className="settings-danger">
          <h2>{t("CouponShare 계정 삭제")}</h2>
          <p>{t("현재 CouponShare 계정과 연결된 데이터와 로그인 계정을 삭제합니다. 삭제 후 같은 이메일 또는 Google 계정으로 다시 가입하면 새 계정으로 시작합니다.")}</p>
          <button type="button" onClick={deleteAccount} disabled={deleting || downloading}>
            {t(deleting ? "삭제 중…" : "계정과 데이터 모두 삭제")}
          </button>
        </article>
        {message && <p className="settings-message" role="status">{t(message)}</p>}
      </section>
      <PolicyLinks settings={false} />
    </main>
  );
}

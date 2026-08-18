"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./profile.module.css";

type AuthStatus = {
  configured: boolean;
  authenticated: boolean;
  autoLogin: boolean;
};

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [autoLogin, setAutoLogin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/status", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<AuthStatus> : null)
      .then((status) => {
        if (cancelled) return;
        if (!status?.configured || !status.authenticated) {
          window.location.replace("/login?returnTo=%2Fprofile");
          return;
        }
        setAutoLogin(status.autoLogin === true);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) window.location.replace("/login?returnTo=%2Fprofile");
      });
    return () => { cancelled = true; };
  }, []);

  async function updateAutoLogin(nextValue: boolean) {
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/auth/preferences", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ autoLogin: nextValue }),
      });
      if (!response.ok) {
        if (response.status === 401) {
          window.location.replace("/login?returnTo=%2Fprofile");
          return;
        }
        throw new Error("save_failed");
      }
      setAutoLogin(nextValue);
      setNotice(nextValue
        ? "자동 로그인을 켰습니다. 이 기기에서 최대 30일 동안 로그인 상태를 유지합니다."
        : "자동 로그인을 껐습니다. 브라우저를 닫으면 현재 로그인 세션이 종료됩니다.");
    } catch {
      setNotice("설정을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className={styles.shell}><div className={styles.loading}>프로필 설정을 불러오고 있습니다…</div></main>;
  }

  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        <header className={styles.header}>
          <div>
            <p>MY COUPONSHARE</p>
            <h1>개인 프로필 설정</h1>
            <span>현재 기기에서 사용할 로그인 설정을 관리하세요.</span>
          </div>
          <Link href="/">메인으로</Link>
        </header>

        <article className={styles.settingRow}>
          <div>
            <strong>자동 로그인</strong>
            <p>켜면 브라우저를 닫았다 다시 열어도 최대 30일 동안 로그인 상태를 유지합니다. 끄면 현재 브라우저 세션에서만 로그인 상태가 유지됩니다.</p>
          </div>
          <label className={styles.switch}>
            <input type="checkbox" checked={autoLogin} disabled={saving} onChange={(event) => void updateAutoLogin(event.target.checked)} />
            <span aria-hidden="true" />
            <b>{autoLogin ? "ON" : "OFF"}</b>
          </label>
        </article>

        {notice && <div className={styles.notice} role="status">{notice}</div>}

        <section className={styles.securityNote}>
          <strong>보안 안내</strong>
          <p>공용 PC나 다른 사람과 함께 사용하는 기기에서는 자동 로그인을 끄는 것을 권장합니다.</p>
        </section>
      </section>
    </main>
  );
}

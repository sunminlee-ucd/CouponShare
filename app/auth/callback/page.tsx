"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "../auth.module.css";

const DEVICE_KEY_STORAGE_KEY = "couponshare-device-key-v2";

function getDeviceKey() {
  const saved = localStorage.getItem(DEVICE_KEY_STORAGE_KEY);
  if (saved) return saved;
  const created = crypto.randomUUID();
  localStorage.setItem(DEVICE_KEY_STORAGE_KEY, created);
  return created;
}

function safeReturnTo(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const finish = async () => {
      const query = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const authError = hash.get("error_description") ?? query.get("error_description") ?? hash.get("error") ?? query.get("error");
      if (authError) {
        setError(authError);
        return;
      }

      const accessToken = hash.get("access_token") ?? query.get("access_token");
      if (!accessToken) {
        setError("로그인 정보를 확인하지 못했습니다. 로그인 화면에서 다시 시도해 주세요.");
        return;
      }

      try {
        const response = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            accessToken,
            deviceKey: getDeviceKey(),
            autoLogin: query.get("autoLogin") === "1",
          }),
        });
        const result = await response.json().catch(() => ({ error: "session_failed" })) as { deviceKey?: string; error?: string };
        if (!response.ok || !result.deviceKey) throw new Error(result.error ?? "session_failed");
        localStorage.setItem(DEVICE_KEY_STORAGE_KEY, result.deviceKey);
        const returnTo = safeReturnTo(query.get("returnTo"));
        window.history.replaceState({}, "", "/auth/callback");
        if (!cancelled) window.location.replace(returnTo);
      } catch {
        if (!cancelled) setError("로그인을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    };
    void finish();
    return () => { cancelled = true; };
  }, []);

  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        <div className={styles.head}>
          <p className={styles.eyebrow}>COUPONSHARE ACCOUNT</p>
          <h1>{error ? "로그인을 완료하지 못했습니다" : "로그인을 완료하고 있습니다"}</h1>
          <p>{error ? "아래 버튼으로 로그인 화면으로 돌아가 다시 시도해 주세요." : "기존 쿠폰과 예약 기록을 계정에 연결하고 있습니다."}</p>
        </div>
        {error ? <div className={styles.error}>{error}</div> : <div className={styles.spinner} aria-label="로그인 처리 중" />}
        {error && <Link className={styles.back} href="/login">로그인으로 돌아가기</Link>}
      </section>
    </main>
  );
}

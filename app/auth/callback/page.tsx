"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "../auth.module.css";

const DEVICE_KEY_STORAGE_KEY = "couponshare-device-key-v2";
const OAUTH_CONTEXT_STORAGE_KEY = "couponshare-oauth-context-v1";
const OAUTH_CONTEXT_MAX_AGE_MS = 15 * 60 * 1000;

function getDeviceKey() {
  const saved = localStorage.getItem(DEVICE_KEY_STORAGE_KEY);
  if (saved) return saved;
  const created = crypto.randomUUID();
  localStorage.setItem(DEVICE_KEY_STORAGE_KEY, created);
  return created;
}

function safeReturnTo(value: unknown) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

type OAuthContext = {
  returnTo: string;
  autoLogin?: boolean;
  intent?: "login" | "signup";
  startedAt?: number;
};

function readOAuthContext(): OAuthContext {
  try {
    const raw = sessionStorage.getItem(OAUTH_CONTEXT_STORAGE_KEY);
    if (!raw) return { returnTo: "/" };
    const parsed = JSON.parse(raw) as Partial<OAuthContext>;
    const startedAt = Number(parsed.startedAt ?? 0);
    if (!Number.isFinite(startedAt) || startedAt <= 0 || Date.now() - startedAt > OAUTH_CONTEXT_MAX_AGE_MS) {
      sessionStorage.removeItem(OAUTH_CONTEXT_STORAGE_KEY);
      return { returnTo: "/" };
    }
    return {
      returnTo: safeReturnTo(parsed.returnTo),
      autoLogin: parsed.autoLogin === true,
      intent: parsed.intent === "signup" ? "signup" : "login",
      startedAt,
    };
  } catch {
    return { returnTo: "/" };
  }
}

export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);
  const [signupCompleted, setSignupCompleted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let redirectTimer: number | undefined;

    const finish = async () => {
      const query = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const context = readOAuthContext();
      const authError = hash.get("error_description") ?? query.get("error_description") ?? hash.get("error") ?? query.get("error");
      if (authError) {
        try { sessionStorage.removeItem(OAUTH_CONTEXT_STORAGE_KEY); } catch { /* ignore */ }
        setError(authError);
        return;
      }

      const accessToken = hash.get("access_token") ?? query.get("access_token");
      if (!accessToken) {
        const code = query.get("code");
        setError(code
          ? "Google 인증 코드는 받았지만 로그인 세션을 만들 수 없습니다. 로그인 화면에서 다시 시도해 주세요."
          : "로그인 정보를 확인하지 못했습니다. 로그인 화면에서 다시 시도해 주세요.");
        return;
      }

      try {
        const response = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            accessToken,
            deviceKey: getDeviceKey(),
            autoLogin: context.autoLogin,
          }),
        });
        const result = await response.json().catch(() => ({ error: "session_failed" })) as { deviceKey?: string; error?: string };
        if (!response.ok || !result.deviceKey) throw new Error(result.error ?? "session_failed");

        localStorage.setItem(DEVICE_KEY_STORAGE_KEY, result.deviceKey);
        try { sessionStorage.removeItem(OAUTH_CONTEXT_STORAGE_KEY); } catch { /* ignore */ }
        window.history.replaceState({}, "", "/auth/callback");

        const signupIntent = context.intent === "signup" || hash.get("type") === "signup" || query.get("type") === "signup";
        if (signupIntent) {
          if (!cancelled) setSignupCompleted(true);
          redirectTimer = window.setTimeout(() => window.location.replace("/"), 1300);
          return;
        }

        if (!cancelled) window.location.replace(context.returnTo);
      } catch {
        if (!cancelled) setError("로그인을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    };

    void finish();
    return () => {
      cancelled = true;
      if (redirectTimer !== undefined) window.clearTimeout(redirectTimer);
    };
  }, []);

  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        <div className={styles.head}>
          <p className={styles.eyebrow}>COUPONSHARE ACCOUNT</p>
          <h1>{error ? "로그인을 완료하지 못했습니다" : signupCompleted ? "회원가입이 성공적으로 되었습니다." : "로그인을 완료하고 있습니다"}</h1>
          <p>{error
            ? "아래 버튼으로 로그인 화면으로 돌아가 다시 시도해 주세요."
            : signupCompleted
              ? "잠시 후 CouponShare 메인 화면으로 이동합니다."
              : "기존 쿠폰과 예약 기록을 계정에 연결하고 있습니다."}</p>
        </div>
        {error
          ? <div className={styles.error}>{error}</div>
          : signupCompleted
            ? <div className={styles.notice} role="status">회원가입이 성공적으로 되었습니다.</div>
            : <div className={styles.spinner} aria-label="로그인 처리 중" />}
        {error && <Link className={styles.back} href="/login">로그인으로 돌아가기</Link>}
      </section>
    </main>
  );
}

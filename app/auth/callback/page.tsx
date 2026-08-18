"use client";

import { useEffect, useState } from "react";
import styles from "../auth.module.css";

const DEVICE_KEY_STORAGE_KEY = "couponshare-device-key-v2";
const OAUTH_CONTEXT_STORAGE_KEY = "couponshare-oauth-context-v1";
const OAUTH_CONTEXT_MAX_AGE_MS = 15 * 60 * 1000;
const CALLBACK_TIMEOUT_MS = 20_000;

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

type Stage = "reading" | "linking" | "done";

type SessionResult = {
  deviceKey?: string;
  email?: string | null;
  provider?: string | null;
  error?: string;
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

function callbackErrorMessage(reason: string) {
  if (reason === "oauth_flow_expired") return "Google 로그인 시간이 만료되었습니다. 로그인 화면에서 다시 시도해 주세요.";
  if (reason === "oauth_code_exchange_failed") return "Google 계정은 선택했지만 Supabase 로그인 세션을 만들지 못했습니다. 다시 시도해 주세요.";
  if (reason === "invalid_auth_token") return "Google 인증 정보가 만료되었거나 유효하지 않습니다. 다시 로그인해 주세요.";
  if (reason === "profile_link_failed") return "Google 계정은 확인했지만 CouponShare 프로필 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.";
  if (reason === "forbidden") return "로그인 요청의 보안 검증에 실패했습니다. 로그인 화면에서 다시 시도해 주세요.";
  return "로그인을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);
  const [signupCompleted, setSignupCompleted] = useState(false);
  const [stage, setStage] = useState<Stage>("reading");
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [redirectTarget, setRedirectTarget] = useState("/");

  useEffect(() => {
    let cancelled = false;
    let redirectTimer: number | undefined;
    const timeout = window.setTimeout(() => {
      if (!cancelled) setError("로그인 처리가 예상보다 오래 걸리고 있습니다. 로그인 화면으로 돌아가 다시 시도해 주세요.");
    }, CALLBACK_TIMEOUT_MS);

    const finish = async () => {
      const query = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const context = readOAuthContext();
      const authError = hash.get("error_description") ?? query.get("error_description") ?? hash.get("error") ?? query.get("error");
      if (authError) {
        try { sessionStorage.removeItem(OAUTH_CONTEXT_STORAGE_KEY); } catch { /* ignore */ }
        window.clearTimeout(timeout);
        setError(authError);
        return;
      }

      const code = query.get("code");
      const accessToken = hash.get("access_token") ?? query.get("access_token");
      if (!code && !accessToken) {
        window.clearTimeout(timeout);
        setError("Google에서 로그인 정보를 받지 못했습니다. 계정 선택 화면에서 다시 시도해 주세요.");
        return;
      }

      setStage("linking");
      try {
        const endpoint = code ? "/api/auth/oauth/exchange" : "/api/auth/session";
        const payload = code
          ? { code, deviceKey: getDeviceKey(), autoLogin: context.autoLogin }
          : { accessToken, deviceKey: getDeviceKey(), autoLogin: context.autoLogin };
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => ({ error: "session_failed" })) as SessionResult;
        if (!response.ok || !result.deviceKey) throw new Error(result.error ?? "session_failed");

        localStorage.setItem(DEVICE_KEY_STORAGE_KEY, result.deviceKey);
        try { sessionStorage.removeItem(OAUTH_CONTEXT_STORAGE_KEY); } catch { /* ignore */ }
        window.history.replaceState({}, "", "/auth/callback");
        window.clearTimeout(timeout);
        if (cancelled) return;

        setAccountEmail(result.email ?? null);
        setStage("done");

        const signupIntent = context.intent === "signup" || hash.get("type") === "signup" || query.get("type") === "signup";
        const target = signupIntent ? "/" : safeReturnTo(context.returnTo);
        setRedirectTarget(target);
        if (signupIntent) setSignupCompleted(true);

        // Keep the success state visible long enough to be understood, then use a native browser redirect.
        redirectTimer = window.setTimeout(() => window.location.assign(target), signupIntent ? 1800 : 900);
      } catch (caught) {
        window.clearTimeout(timeout);
        if (!cancelled) {
          const reason = caught instanceof Error ? caught.message : "session_failed";
          setError(callbackErrorMessage(reason));
        }
      }
    };

    void finish();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      if (redirectTimer !== undefined) window.clearTimeout(redirectTimer);
    };
  }, []);

  const stageTitle = stage === "reading"
    ? "Google 로그인 정보를 확인하고 있습니다"
    : stage === "linking"
      ? "CouponShare 계정에 연결하고 있습니다"
      : signupCompleted
        ? "회원가입이 성공적으로 되었습니다."
        : "Google 로그인이 완료되었습니다";

  const stageDescription = stage === "reading"
    ? "Google에서 전달한 인증 정보를 확인하고 있습니다."
    : stage === "linking"
      ? "Supabase 세션을 만든 뒤 기존 쿠폰과 예약 기록을 현재 계정에 연결하고 있습니다."
      : accountEmail
        ? `${accountEmail} 계정으로 로그인되었습니다. 잠시 후 이동합니다.`
        : "로그인이 완료되었습니다. 잠시 후 이동합니다.";

  return (
    <main className={styles.shell}>
      <section className={styles.card} aria-busy={!error && stage !== "done"}>
        <div className={styles.head}>
          <p className={styles.eyebrow}>COUPONSHARE ACCOUNT</p>
          <h1>{error ? "로그인을 완료하지 못했습니다" : stageTitle}</h1>
          <p>{error
            ? "아래 버튼으로 로그인 화면으로 돌아가 다시 시도해 주세요."
            : stageDescription}</p>
        </div>
        {error
          ? <div className={styles.error} role="alert">{error}</div>
          : stage === "done"
            ? <div className={styles.notice} role="status">{signupCompleted ? "회원가입이 성공적으로 되었습니다." : "Google 로그인이 완료되었습니다."}{accountEmail ? ` ${accountEmail}` : ""}</div>
            : <div className={styles.authProgress} role="status" aria-live="polite"><span className={styles.spinner} aria-hidden="true" /><div><strong>{stageTitle}</strong><small>{stageDescription}</small></div></div>}
        {error && <a className={styles.back} href="/login">로그인으로 돌아가기</a>}
        {!error && stage === "done" && <a className={styles.back} href={redirectTarget}>계속하기</a>}
      </section>
    </main>
  );
}

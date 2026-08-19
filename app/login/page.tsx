"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/app/i18n";
import styles from "../auth/auth.module.css";

const DEVICE_KEY_STORAGE_KEY = "couponshare-device-key-v2";
const OAUTH_CONTEXT_STORAGE_KEY = "couponshare-oauth-context-v1";

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

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function GoogleLogo() {
  return (
    <svg className={styles.googleLogo} viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.797 2.715v2.258h2.909c1.702-1.567 2.684-3.878 2.684-6.614Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.468-.806 5.956-2.181l-2.909-2.258c-.806.54-1.835.859-3.047.859-2.344 0-4.328-1.584-5.037-3.714H.956v2.332A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.963 10.706A5.41 5.41 0 0 1 3.682 9c0-.592.102-1.167.281-1.706V4.962H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.038l3.007-2.332Z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.507.454 3.441 1.346l2.581-2.581C13.464.892 11.426 0 9 0A9 9 0 0 0 .956 4.962l3.007 2.332C4.672 5.164 6.656 3.58 9 3.58Z" />
    </svg>
  );
}

type AuthStatus = {
  configured: boolean;
  authenticated: boolean;
  autoLogin?: boolean;
  email?: string | null;
  provider?: string | null;
};

type AuthResult = {
  confirmationRequired?: boolean;
  deviceKey?: string;
  email?: string | null;
  error?: string;
  message?: string;
};

async function confirmedAuthStatus() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch("/api/auth/status", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (response.ok) {
        const status = await response.json() as AuthStatus;
        if (status.authenticated) return status;
      }
    } catch {
      // A freshly written auth cookie can be visible on the next request.
    }
    if (attempt < 2) await sleep(180);
  }
  return null;
}

export default function LoginPage() {
  const { language } = useLanguage();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [autoLogin, setAutoLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [browseBusy, setBrowseBusy] = useState(false);
  const [navigationPending, setNavigationPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [oauthErrorCode, setOauthErrorCode] = useState<string | null>(null);
  const [returnTo, setReturnTo] = useState("/");
  const [continueTo, setContinueTo] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextReturnTo = safeReturnTo(params.get("returnTo"));
    setReturnTo(nextReturnTo);
    const oauthError = params.get("oauthError");
    if (oauthError) {
      setOauthErrorCode(oauthError);
      params.delete("oauthError");
      const query = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    }

    let cancelled = false;
    void fetch("/api/auth/status", { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => response.ok ? response.json() as Promise<AuthStatus> : null)
      .then((status) => {
        if (cancelled || !status) return;
        setAutoLogin(status.autoLogin === true);
        if (status.authenticated) window.location.assign(nextReturnTo);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const copy = useMemo(() => language === "en" ? {
    eyebrow: "COUPONSHARE",
    title: mode === "login" ? "Sign in" : "Create an account",
    login: "Sign in",
    signup: "Sign up",
    email: "Email",
    password: "Password",
    confirmPassword: "Confirm password",
    passwordHint: "At least 8 characters",
    confirmPasswordHint: "Enter the same password again",
    passwordMismatch: "The passwords do not match.",
    autoLogin: "Keep me signed in",
    autoLoginHint: "Up to 30 days on this device.",
    submit: mode === "login" ? "Sign in with email" : "Create account with email",
    or: "or",
    google: mode === "login" ? "Sign in with Google" : "Sign up with Google",
    browse: "Browse without signing in",
    browseHint: "Browse only. Sign in to upload or reserve.",
    signupSuccess: "Your account was created successfully.",
    loginSuccess: "Sign-in completed successfully.",
    confirmation: "Check your email to confirm your account, then return to CouponShare.",
    redirecting: "Taking you to CouponShare now…",
    continue: "Continue to CouponShare",
    sessionError: "Authentication succeeded, but CouponShare could not confirm the login session. Please try again.",
    error: "Could not complete authentication. Check your details and try again.",
    invalidCredentials: "The email or password is incorrect.",
    emailNotConfirmed: "Confirm your email before signing in.",
    alreadyRegistered: "This email is already registered. Try signing in instead.",
    oauthError: "Google authentication could not start. Please try again.",
    oauthConfigError: "Google authentication is not configured correctly on the server.",
    emailWorking: mode === "login" ? "Signing in…" : "Creating your account…",
    oauthWorking: "Opening Google account selection…",
    workingHint: "Please keep this page open.",
    browseError: "Could not start browse mode. Please try again.",
  } : language === "fa" ? {
    eyebrow: "COUPONSHARE",
    title: mode === "login" ? "ورود" : "ساخت حساب",
    login: "ورود",
    signup: "ثبت‌نام",
    email: "ایمیل",
    password: "رمز عبور",
    confirmPassword: "تکرار رمز عبور",
    passwordHint: "حداقل ۸ کاراکتر",
    confirmPasswordHint: "رمز عبور را دوباره وارد کنید",
    passwordMismatch: "رمزهای عبور یکسان نیستند.",
    autoLogin: "ورود خودکار",
    autoLoginHint: "تا ۳۰ روز در این دستگاه.",
    submit: mode === "login" ? "ورود با ایمیل" : "ساخت حساب با ایمیل",
    or: "یا",
    google: mode === "login" ? "ورود با Google" : "ثبت‌نام با Google",
    browse: "مشاهده بدون ورود",
    browseHint: "فقط مشاهده؛ ثبت و رزرو نیاز به ورود دارد.",
    signupSuccess: "ثبت‌نام با موفقیت انجام شد.",
    loginSuccess: "ورود با موفقیت انجام شد.",
    confirmation: "ایمیل خود را برای تأیید حساب بررسی کنید و سپس به CouponShare برگردید.",
    redirecting: "در حال انتقال به CouponShare…",
    continue: "ادامه به CouponShare",
    sessionError: "احراز هویت انجام شد اما نشست CouponShare تأیید نشد. دوباره تلاش کنید.",
    error: "ورود یا ثبت‌نام انجام نشد. اطلاعات را بررسی کرده و دوباره امتحان کنید.",
    invalidCredentials: "ایمیل یا رمز عبور صحیح نیست.",
    emailNotConfirmed: "قبل از ورود، ایمیل خود را تأیید کنید.",
    alreadyRegistered: "این ایمیل قبلاً ثبت شده است. وارد حساب شوید.",
    oauthError: "ورود با Google شروع نشد. دوباره تلاش کنید.",
    oauthConfigError: "تنظیمات Google در سرور کامل نیست.",
    emailWorking: mode === "login" ? "در حال ورود…" : "در حال ساخت حساب…",
    oauthWorking: "در حال باز کردن انتخاب حساب Google…",
    workingHint: "لطفاً این صفحه را باز نگه دارید.",
    browseError: "حالت مشاهده فعال نشد. دوباره تلاش کنید.",
  } : {
    eyebrow: "COUPONSHARE",
    title: mode === "login" ? "로그인" : "회원가입",
    login: "로그인",
    signup: "회원가입",
    email: "이메일",
    password: "비밀번호",
    confirmPassword: "비밀번호 확인",
    passwordHint: "8자 이상",
    confirmPasswordHint: "비밀번호를 한 번 더 입력하세요",
    passwordMismatch: "비밀번호가 서로 일치하지 않습니다.",
    autoLogin: "자동 로그인",
    autoLoginHint: "이 기기에서 최대 30일 유지",
    submit: mode === "login" ? "이메일로 로그인" : "이메일로 회원가입",
    or: "또는",
    google: mode === "login" ? "Google로 로그인" : "Google로 빠른 회원가입",
    browse: "로그인 없이 둘러보기",
    browseHint: "조회만 가능 · 등록과 예약은 로그인 필요",
    signupSuccess: "회원가입이 성공적으로 되었습니다.",
    loginSuccess: "로그인이 성공적으로 완료되었습니다.",
    confirmation: "확인 이메일을 보냈습니다. 이메일에서 계정을 확인한 뒤 CouponShare로 돌아와 주세요.",
    redirecting: "CouponShare 메인 화면으로 이동 중입니다…",
    continue: "CouponShare로 계속하기",
    sessionError: "인증은 완료됐지만 CouponShare 로그인 세션을 확인하지 못했습니다. 다시 시도해 주세요.",
    error: "로그인 또는 회원가입을 완료하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.",
    invalidCredentials: "이메일 또는 비밀번호가 올바르지 않습니다.",
    emailNotConfirmed: "이메일 인증을 완료한 뒤 로그인해 주세요.",
    alreadyRegistered: "이미 가입된 이메일입니다. 로그인 탭에서 로그인해 주세요.",
    oauthError: "Google 인증을 시작하지 못했습니다. 다시 시도해 주세요.",
    oauthConfigError: "서버의 Google 로그인 설정이 완료되지 않았습니다.",
    emailWorking: mode === "login" ? "로그인 중입니다…" : "회원가입 처리 중입니다…",
    oauthWorking: "Google 계정 선택 화면으로 이동 중입니다…",
    workingHint: "인증을 준비하고 있습니다. 이 페이지를 닫지 마세요.",
    browseError: "둘러보기 모드를 시작하지 못했습니다. 다시 시도해 주세요.",
  }, [language, mode]);

  const visibleError = error ?? (oauthErrorCode
    ? oauthErrorCode === "auth_not_configured" ? copy.oauthConfigError : copy.oauthError
    : null);

  function mapAuthError(message: string | undefined) {
    const normalized = (message ?? "").toLowerCase();
    if (normalized.includes("invalid login credentials")) return copy.invalidCredentials;
    if (normalized.includes("email not confirmed")) return copy.emailNotConfirmed;
    if (normalized.includes("already registered") || normalized.includes("user already exists")) return copy.alreadyRegistered;
    if (normalized.includes("forbidden")) return copy.error;
    return copy.error;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setOauthErrorCode(null);
    setNotice(null);
    setContinueTo(null);
    setNavigationPending(false);

    if (mode === "signup" && password !== confirmPassword) {
      setError(copy.passwordMismatch);
      return;
    }

    setBusy(true);
    let keepBusy = false;
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, email, password, deviceKey: getDeviceKey(), returnTo, autoLogin }),
      });
      const result = await response.json().catch(() => ({ error: "invalid_server_response" })) as AuthResult;
      if (!response.ok) throw new Error(mapAuthError(result.message ?? result.error));

      if (result.confirmationRequired) {
        setPassword("");
        setConfirmPassword("");
        setNotice(`${copy.signupSuccess} ${copy.confirmation}`);
        return;
      }

      if (!result.deviceKey) throw new Error(copy.error);
      localStorage.setItem(DEVICE_KEY_STORAGE_KEY, result.deviceKey);

      const status = await confirmedAuthStatus();
      if (!status?.authenticated) throw new Error(copy.sessionError);

      const target = mode === "signup" ? "/" : returnTo;
      const identity = status.email ? ` ${status.email}` : "";
      setPassword("");
      setConfirmPassword("");
      setContinueTo(target);
      setNavigationPending(true);
      setNotice(`${mode === "signup" ? copy.signupSuccess : copy.loginSuccess}${identity} ${copy.redirecting}`);
      keepBusy = true;

      window.setTimeout(() => window.location.assign(target), mode === "signup" ? 1200 : 700);
      window.setTimeout(() => setBusy(false), 4000);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.error);
    } finally {
      if (!keepBusy) setBusy(false);
    }
  }

  function switchMode(nextMode: "login" | "signup") {
    if (busy || oauthBusy || navigationPending) return;
    setMode(nextMode);
    setConfirmPassword("");
    setError(null);
    setOauthErrorCode(null);
    setNotice(null);
    setContinueTo(null);
  }

  function continueWithGoogle() {
    setError(null);
    setOauthErrorCode(null);
    setNotice(copy.oauthWorking);
    setContinueTo(null);
    setOauthBusy(true);
    try {
      sessionStorage.setItem(OAUTH_CONTEXT_STORAGE_KEY, JSON.stringify({
        returnTo,
        autoLogin,
        intent: mode,
        startedAt: Date.now(),
      }));
    } catch {
      // OAuth continues with safe defaults if tab storage is unavailable.
    }

    window.setTimeout(() => {
      window.location.assign("/api/auth/oauth?provider=google");
    }, 100);
  }

  async function browse() {
    setBrowseBusy(true);
    setError(null);
    setOauthErrorCode(null);
    setNotice(null);
    setContinueTo(null);
    try {
      const response = await fetch("/api/auth/browse", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error("browse_failed");
      window.location.assign("/");
    } catch {
      setError(copy.browseError);
      setBrowseBusy(false);
    }
  }

  const authBusy = busy || oauthBusy || navigationPending;

  return (
    <main className={styles.shell} dir={language === "fa" ? "rtl" : undefined}>
      <section className={styles.card} aria-busy={authBusy}>
        <div className={styles.head}>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
        </div>

        {visibleError && <div className={styles.error} role="alert" aria-live="assertive">{visibleError}</div>}
        {notice && <div className={styles.notice} role="status" aria-live="polite">{notice}</div>}
        {continueTo && <a className={styles.back} href={continueTo}>{copy.continue}</a>}

        <div className={styles.tabs} role="tablist">
          <button className={mode === "login" ? styles.active : ""} disabled={authBusy} type="button" onClick={() => switchMode("login")}>{copy.login}</button>
          <button className={mode === "signup" ? styles.active : ""} disabled={authBusy} type="button" onClick={() => switchMode("signup")}>{copy.signup}</button>
        </div>

        {authBusy && (
          <div className={styles.authProgress} role="status" aria-live="polite">
            <span className={styles.spinner} aria-hidden="true" />
            <div><strong>{oauthBusy ? copy.oauthWorking : navigationPending ? copy.redirecting : copy.emailWorking}</strong><small>{copy.workingHint}</small></div>
          </div>
        )}

        <div className={styles.socials}>
          <button className={styles.social} type="button" disabled={authBusy || browseBusy} onClick={continueWithGoogle}>
            <GoogleLogo />
            <span>{oauthBusy ? copy.oauthWorking : copy.google}</span>
          </button>
        </div>

        <div className={styles.divider}>{copy.or}</div>

        <form className={styles.form} onSubmit={submit}>
          <label>{copy.email}<input type="email" autoComplete="email" disabled={authBusy} required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>{copy.password}<input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} disabled={authBusy} minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder={copy.passwordHint} /></label>
          {mode === "signup" && <label>{copy.confirmPassword}<input type="password" autoComplete="new-password" disabled={authBusy} minLength={8} maxLength={128} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder={copy.confirmPasswordHint} /></label>}
          <label className={styles.autoLoginRow}>
            <input type="checkbox" checked={autoLogin} disabled={authBusy} onChange={(event) => setAutoLogin(event.target.checked)} />
            <span><strong>{copy.autoLogin}</strong><small>{copy.autoLoginHint}</small></span>
          </label>
          <button className={styles.primary} type="submit" disabled={authBusy || browseBusy}>{busy ? (navigationPending ? copy.redirecting : copy.emailWorking) : copy.submit}</button>
        </form>

        <div className={styles.browseBox}>
          <button className={styles.browseButton} type="button" disabled={authBusy || browseBusy} onClick={() => void browse()}>{browseBusy ? `${copy.browse}…` : copy.browse}</button>
          <small>{copy.browseHint}</small>
        </div>
      </section>
    </main>
  );
}

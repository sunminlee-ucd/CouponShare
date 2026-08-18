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
};

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
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [oauthErrorCode, setOauthErrorCode] = useState<string | null>(null);
  const [returnTo, setReturnTo] = useState("/");

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
    void fetch("/api/auth/status", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<AuthStatus> : null)
      .then((status) => {
        if (cancelled || !status) return;
        setAutoLogin(status.autoLogin === true);
        if (status.authenticated) window.location.replace(nextReturnTo);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const copy = useMemo(() => language === "en" ? {
    eyebrow: "COUPONSHARE ACCOUNT",
    title: mode === "login" ? "Sign in" : "Create an account",
    description: "Keep your voucher history and reservations connected to the same account across devices.",
    login: "Sign in",
    signup: "Sign up",
    email: "Email",
    password: "Password",
    confirmPassword: "Confirm password",
    passwordHint: "At least 8 characters",
    confirmPasswordHint: "Enter the same password again",
    passwordMismatch: "The passwords do not match.",
    autoLogin: "Keep me signed in",
    autoLoginHint: "Keep this device signed in for up to 30 days.",
    submit: mode === "login" ? "Sign in with email" : "Create account with email",
    or: "or",
    google: mode === "login" ? "Sign in with Google" : "Sign up with Google",
    browse: "Browse without signing in",
    browseHint: "You can view available vouchers, but uploading and reservations require an account.",
    signupSuccess: "Your account was created successfully.",
    confirmation: "Check your email to confirm your account, then return to CouponShare.",
    error: "Could not complete authentication. Check your details and try again.",
    invalidCredentials: "The email or password is incorrect.",
    emailNotConfirmed: "Confirm your email before signing in.",
    alreadyRegistered: "This email is already registered. Try signing in instead.",
    oauthError: "Google authentication could not start. Please try again.",
    oauthConfigError: "Google authentication is not configured correctly on the server.",
    emailWorking: mode === "login" ? "Signing in…" : "Creating your account…",
    oauthWorking: "Opening Google account selection…",
    workingHint: "Please keep this page open while authentication is being prepared.",
    browseError: "Could not start browse mode. Please try again.",
    foot: "Use email and password directly, continue with Google, or enter browse-only mode.",
  } : language === "fa" ? {
    eyebrow: "حساب COUPONSHARE",
    title: mode === "login" ? "ورود" : "ساخت حساب",
    description: "سوابق ووچر و رزروهای خود را در دستگاه‌های مختلف به یک حساب متصل نگه دارید.",
    login: "ورود",
    signup: "ثبت‌نام",
    email: "ایمیل",
    password: "رمز عبور",
    confirmPassword: "تکرار رمز عبور",
    passwordHint: "حداقل ۸ کاراکتر",
    confirmPasswordHint: "رمز عبور را دوباره وارد کنید",
    passwordMismatch: "رمزهای عبور یکسان نیستند.",
    autoLogin: "ورود خودکار",
    autoLoginHint: "ورود این دستگاه را تا ۳۰ روز حفظ کنید.",
    submit: mode === "login" ? "ورود با ایمیل" : "ساخت حساب با ایمیل",
    or: "یا",
    google: mode === "login" ? "ورود با Google" : "ثبت‌نام با Google",
    browse: "مشاهده بدون ورود",
    browseHint: "می‌توانید ووچرها را ببینید، اما ثبت و رزرو نیاز به حساب دارد.",
    signupSuccess: "ثبت‌نام با موفقیت انجام شد.",
    confirmation: "ایمیل خود را برای تأیید حساب بررسی کنید و سپس به CouponShare برگردید.",
    error: "ورود یا ثبت‌نام انجام نشد. اطلاعات را بررسی کرده و دوباره امتحان کنید.",
    invalidCredentials: "ایمیل یا رمز عبور صحیح نیست.",
    emailNotConfirmed: "قبل از ورود، ایمیل خود را تأیید کنید.",
    alreadyRegistered: "این ایمیل قبلاً ثبت شده است. وارد حساب شوید.",
    oauthError: "ورود با Google شروع نشد. دوباره تلاش کنید.",
    oauthConfigError: "تنظیمات Google در سرور کامل نیست.",
    emailWorking: mode === "login" ? "در حال ورود…" : "در حال ساخت حساب…",
    oauthWorking: "در حال باز کردن انتخاب حساب Google…",
    workingHint: "لطفاً تا آماده شدن ورود این صفحه را باز نگه دارید.",
    browseError: "حالت مشاهده فعال نشد. دوباره تلاش کنید.",
    foot: "با ایمیل ثبت‌نام کنید، از Google استفاده کنید یا فقط برای مشاهده وارد شوید.",
  } : {
    eyebrow: "COUPONSHARE ACCOUNT",
    title: mode === "login" ? "로그인" : "회원가입",
    description: "쿠폰 기록과 예약 내역을 같은 계정에 연결해 다른 기기에서도 이어서 이용하세요.",
    login: "로그인",
    signup: "회원가입",
    email: "이메일",
    password: "비밀번호",
    confirmPassword: "비밀번호 확인",
    passwordHint: "8자 이상",
    confirmPasswordHint: "비밀번호를 한 번 더 입력하세요",
    passwordMismatch: "비밀번호가 서로 일치하지 않습니다.",
    autoLogin: "자동 로그인",
    autoLoginHint: "이 기기에서 최대 30일 동안 로그인 상태를 유지합니다.",
    submit: mode === "login" ? "이메일로 로그인" : "이메일로 직접 회원가입",
    or: "또는",
    google: mode === "login" ? "Google로 로그인" : "Google로 빠른 회원가입",
    browse: "로그인 없이 둘러보기",
    browseHint: "바우처 목록은 볼 수 있지만 등록과 예약은 로그인 후 이용할 수 있습니다.",
    signupSuccess: "회원가입이 성공적으로 되었습니다.",
    confirmation: "확인 이메일을 보냈습니다. 이메일에서 계정을 확인한 뒤 CouponShare로 돌아와 주세요.",
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
    foot: "이메일로 직접 가입하거나 Google 계정을 이용하거나 둘러보기 모드로 입장할 수 있습니다.",
  }, [language, mode]);

  const visibleError = error ?? (oauthErrorCode
    ? oauthErrorCode === "auth_not_configured" ? copy.oauthConfigError : copy.oauthError
    : null);

  function mapAuthError(message: string | undefined) {
    const normalized = (message ?? "").toLowerCase();
    if (normalized.includes("invalid login credentials")) return copy.invalidCredentials;
    if (normalized.includes("email not confirmed")) return copy.emailNotConfirmed;
    if (normalized.includes("already registered") || normalized.includes("user already exists")) return copy.alreadyRegistered;
    return copy.error;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setOauthErrorCode(null);
    setNotice(null);

    if (mode === "signup" && password !== confirmPassword) {
      setError(copy.passwordMismatch);
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, email, password, deviceKey: getDeviceKey(), returnTo, autoLogin }),
      });
      const result = await response.json().catch(() => ({ error: "auth_failed" })) as {
        confirmationRequired?: boolean;
        deviceKey?: string;
        message?: string;
      };
      if (!response.ok) throw new Error(mapAuthError(result.message));
      if (result.confirmationRequired) {
        setPassword("");
        setConfirmPassword("");
        setNotice(`${copy.signupSuccess} ${copy.confirmation}`);
        return;
      }
      if (!result.deviceKey) throw new Error(copy.error);
      localStorage.setItem(DEVICE_KEY_STORAGE_KEY, result.deviceKey);
      if (mode === "signup") {
        setPassword("");
        setConfirmPassword("");
        setNotice(copy.signupSuccess);
        window.setTimeout(() => window.location.replace("/"), 1200);
        return;
      }
      window.location.replace(returnTo);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.error);
    } finally {
      setBusy(false);
    }
  }

  function switchMode(nextMode: "login" | "signup") {
    if (busy || oauthBusy) return;
    setMode(nextMode);
    setConfirmPassword("");
    setError(null);
    setOauthErrorCode(null);
    setNotice(null);
  }

  function continueWithGoogle() {
    setError(null);
    setOauthErrorCode(null);
    setNotice(copy.oauthWorking);
    setOauthBusy(true);
    try {
      sessionStorage.setItem(OAUTH_CONTEXT_STORAGE_KEY, JSON.stringify({
        returnTo,
        autoLogin,
        intent: mode,
        startedAt: Date.now(),
      }));
    } catch {
      // OAuth still works with safe defaults if tab storage is unavailable.
    }

    // Give React one frame to paint the progress state before leaving the page.
    window.setTimeout(() => {
      window.location.assign("/api/auth/oauth?provider=google");
    }, 80);
  }

  async function browse() {
    setBrowseBusy(true);
    setError(null);
    setOauthErrorCode(null);
    try {
      const response = await fetch("/api/auth/browse", { method: "POST" });
      if (!response.ok) throw new Error("browse_failed");
      window.location.replace("/");
    } catch {
      setError(copy.browseError);
      setBrowseBusy(false);
    }
  }

  const authBusy = busy || oauthBusy;

  return (
    <main className={styles.shell} dir={language === "fa" ? "rtl" : undefined}>
      <section className={styles.card} aria-busy={authBusy}>
        <div className={styles.head}>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>

        <div className={styles.tabs} role="tablist">
          <button className={mode === "login" ? styles.active : ""} disabled={authBusy} type="button" onClick={() => switchMode("login")}>{copy.login}</button>
          <button className={mode === "signup" ? styles.active : ""} disabled={authBusy} type="button" onClick={() => switchMode("signup")}>{copy.signup}</button>
        </div>

        {authBusy && (
          <div className={styles.authProgress} role="status" aria-live="polite">
            <span className={styles.spinner} aria-hidden="true" />
            <div><strong>{oauthBusy ? copy.oauthWorking : copy.emailWorking}</strong><small>{copy.workingHint}</small></div>
          </div>
        )}

        <form className={styles.form} onSubmit={submit}>
          <label>{copy.email}<input type="email" autoComplete="email" disabled={authBusy} required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>{copy.password}<input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} disabled={authBusy} minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder={copy.passwordHint} /></label>
          {mode === "signup" && <label>{copy.confirmPassword}<input type="password" autoComplete="new-password" disabled={authBusy} minLength={8} maxLength={128} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder={copy.confirmPasswordHint} /></label>}
          <label className={styles.autoLoginRow}>
            <input type="checkbox" checked={autoLogin} disabled={authBusy} onChange={(event) => setAutoLogin(event.target.checked)} />
            <span><strong>{copy.autoLogin}</strong><small>{copy.autoLoginHint}</small></span>
          </label>
          <button className={styles.primary} type="submit" disabled={authBusy || browseBusy}>{busy ? copy.emailWorking : copy.submit}</button>
        </form>

        {notice && <div className={styles.notice} role="status">{notice}</div>}
        {visibleError && <div className={styles.error} role="alert">{visibleError}</div>}

        <div className={styles.divider}>{copy.or}</div>
        <div className={styles.socials}>
          <button className={styles.social} type="button" disabled={authBusy || browseBusy} onClick={continueWithGoogle}><GoogleLogo /><span>{oauthBusy ? copy.oauthWorking : copy.google}</span></button>
        </div>

        <div className={styles.browseBox}>
          <button className={styles.browseButton} type="button" disabled={authBusy || browseBusy} onClick={() => void browse()}>{browseBusy ? `${copy.browse}…` : copy.browse}</button>
          <small>{copy.browseHint}</small>
        </div>

        <p className={styles.foot}>{copy.foot}</p>
      </section>
    </main>
  );
}

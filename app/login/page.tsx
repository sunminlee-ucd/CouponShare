"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/app/i18n";
import styles from "../auth/auth.module.css";

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

export default function LoginPage() {
  const { language } = useLanguage();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [returnTo, setReturnTo] = useState("/");

  useEffect(() => {
    setReturnTo(safeReturnTo(new URLSearchParams(window.location.search).get("returnTo")));
  }, []);

  const copy = useMemo(() => language === "en" ? {
    eyebrow: "COUPONSHARE ACCOUNT",
    title: mode === "login" ? "Sign in" : "Create an account",
    description: "Keep your voucher history and reservations connected to the same account across devices.",
    login: "Sign in",
    signup: "Sign up",
    email: "Email",
    password: "Password",
    passwordHint: "At least 8 characters",
    submit: mode === "login" ? "Sign in with email" : "Create account with email",
    or: "or",
    google: mode === "login" ? "Sign in with Google" : "Sign up with Google",
    back: "Back to CouponShare",
    confirmation: "Check your email to confirm your account, then return to CouponShare.",
    error: "Could not complete authentication. Check your details and try again.",
    foot: "You can use email and password directly, or continue with Google.",
  } : language === "fa" ? {
    eyebrow: "حساب COUPONSHARE",
    title: mode === "login" ? "ورود" : "ساخت حساب",
    description: "سوابق ووچر و رزروهای خود را در دستگاه‌های مختلف به یک حساب متصل نگه دارید.",
    login: "ورود",
    signup: "ثبت‌نام",
    email: "ایمیل",
    password: "رمز عبور",
    passwordHint: "حداقل ۸ کاراکتر",
    submit: mode === "login" ? "ورود با ایمیل" : "ساخت حساب با ایمیل",
    or: "یا",
    google: mode === "login" ? "ورود با Google" : "ثبت‌نام با Google",
    back: "بازگشت به CouponShare",
    confirmation: "ایمیل خود را برای تأیید حساب بررسی کنید و سپس به CouponShare برگردید.",
    error: "ورود یا ثبت‌نام انجام نشد. اطلاعات را بررسی کرده و دوباره امتحان کنید.",
    foot: "می‌توانید مستقیماً با ایمیل و رمز عبور ثبت‌نام کنید یا از Google استفاده کنید.",
  } : {
    eyebrow: "COUPONSHARE ACCOUNT",
    title: mode === "login" ? "로그인" : "회원가입",
    description: "쿠폰 기록과 예약 내역을 같은 계정에 연결해 다른 기기에서도 이어서 이용하세요.",
    login: "로그인",
    signup: "회원가입",
    email: "이메일",
    password: "비밀번호",
    passwordHint: "8자 이상",
    submit: mode === "login" ? "이메일로 로그인" : "이메일로 직접 회원가입",
    or: "또는",
    google: mode === "login" ? "Google로 로그인" : "Google로 빠른 회원가입",
    back: "CouponShare로 돌아가기",
    confirmation: "확인 이메일을 보냈습니다. 이메일에서 계정을 확인한 뒤 CouponShare로 돌아와 주세요.",
    error: "로그인 또는 회원가입을 완료하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.",
    foot: "이메일과 비밀번호로 직접 가입하거나 Google 계정으로 빠르게 가입할 수 있습니다.",
  }, [language, mode]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, email, password, deviceKey: getDeviceKey(), returnTo }),
      });
      const result = await response.json().catch(() => ({ error: "auth_failed" })) as {
        confirmationRequired?: boolean;
        deviceKey?: string;
        message?: string;
      };
      if (!response.ok) throw new Error(result.message ?? "auth_failed");
      if (result.confirmationRequired) {
        setNotice(copy.confirmation);
        return;
      }
      if (!result.deviceKey) throw new Error("profile_link_failed");
      localStorage.setItem(DEVICE_KEY_STORAGE_KEY, result.deviceKey);
      window.location.replace(returnTo);
    } catch {
      setError(copy.error);
    } finally {
      setBusy(false);
    }
  }

  function continueWithGoogle() {
    const query = new URLSearchParams({ provider: "google", returnTo });
    window.location.assign(`/api/auth/oauth?${query.toString()}`);
  }

  return (
    <main className={styles.shell} dir={language === "fa" ? "rtl" : undefined}>
      <section className={styles.card}>
        <div className={styles.head}>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>

        <div className={styles.tabs} role="tablist">
          <button className={mode === "login" ? styles.active : ""} type="button" onClick={() => { setMode("login"); setError(null); setNotice(null); }}>{copy.login}</button>
          <button className={mode === "signup" ? styles.active : ""} type="button" onClick={() => { setMode("signup"); setError(null); setNotice(null); }}>{copy.signup}</button>
        </div>

        <form className={styles.form} onSubmit={submit}>
          <label>{copy.email}<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>{copy.password}<input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder={copy.passwordHint} /></label>
          <button className={styles.primary} type="submit" disabled={busy}>{busy ? `${copy.submit}…` : copy.submit}</button>
        </form>

        {notice && <div className={styles.notice}>{notice}</div>}
        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.divider}>{copy.or}</div>
        <div className={styles.socials}>
          <button className={styles.social} type="button" onClick={continueWithGoogle}><span className={styles.socialMark}>G</span>{copy.google}</button>
        </div>

        <p className={styles.foot}>{copy.foot}</p>
        <Link className={styles.back} href={returnTo}>{copy.back}</Link>
      </section>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import ErrorReportButton from "./ErrorReportButton";
import { type AppLanguage, useLanguage } from "./i18n";
import styles from "./AppSidebar.module.css";

const DEVICE_KEY_STORAGE_KEY = "couponshare-device-key-v2";

type Status = {
  configured: boolean;
  authenticated: boolean;
  browsing?: boolean;
  email?: string | null;
  provider?: string | null;
};

const languages: Array<{ id: AppLanguage; label: string }> = [
  { id: "ko", label: "한국어" },
  { id: "en", label: "English" },
  { id: "fa", label: "فارسی" },
];

function providerLabel(provider: string | null | undefined) {
  return provider === "google" ? "Google" : "Email";
}

export default function AppSidebar() {
  const pathname = usePathname();
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  const visible = pathname === "/"
    || pathname === "/dunnes"
    || pathname.startsWith("/dunnes/")
    || pathname.startsWith("/lidl-import");

  const copy = useMemo(() => language === "en" ? {
    openMenu: "Open menu",
    closeMenu: "Close menu",
    menu: "Menu",
    account: "Account",
    browse: "Browse mode",
    signedOut: "Not signed in",
    profile: "Profile settings",
    data: "My data",
    language: "Language",
    login: "Sign in / Sign up",
    logout: "Sign out",
    home: "Home",
    dunnes: "Dunnes vouchers",
  } : language === "fa" ? {
    openMenu: "باز کردن منو",
    closeMenu: "بستن منو",
    menu: "منو",
    account: "حساب",
    browse: "حالت مشاهده",
    signedOut: "وارد نشده‌اید",
    profile: "تنظیمات پروفایل",
    data: "داده‌های من",
    language: "زبان",
    login: "ورود / ثبت‌نام",
    logout: "خروج",
    home: "خانه",
    dunnes: "ووچرهای Dunnes",
  } : {
    openMenu: "메뉴 열기",
    closeMenu: "메뉴 닫기",
    menu: "메뉴",
    account: "계정",
    browse: "둘러보기 모드",
    signedOut: "로그인하지 않음",
    profile: "프로필 설정",
    data: "내 데이터 관리",
    language: "언어 설정",
    login: "로그인 / 회원가입",
    logout: "로그아웃",
    home: "홈",
    dunnes: "Dunnes 바우처",
  }, [language]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void fetch("/api/auth/status", { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => response.ok ? response.json() as Promise<Status> : null)
      .then((result) => { if (!cancelled) setStatus(result); })
      .catch(() => { if (!cancelled) setStatus(null); });
    return () => { cancelled = true; };
  }, [pathname, visible]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
        return;
      }
      if (event.key !== "Tab") return;
      const drawer = drawerRef.current;
      if (!drawer) return;
      const focusable = [...drawer.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!visible) return null;

  function closeDrawer(restoreFocus = true) {
    setOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function prepareLogout() {
    try {
      localStorage.removeItem(DEVICE_KEY_STORAGE_KEY);
    } catch {
      // Server-side logout remains authoritative when browser storage is unavailable.
    }
  }

  const email = status?.email || (status?.browsing ? copy.browse : copy.signedOut);

  return (
    <>
      <button
        aria-controls="couponshare-app-menu"
        aria-expanded={open}
        aria-label={copy.openMenu}
        className={styles.trigger}
        onClick={() => setOpen(true)}
        ref={triggerRef}
        type="button"
      >
        <span /><span /><span />
      </button>

      <button
        aria-label={copy.closeMenu}
        className={`${styles.backdrop}${open ? ` ${styles.backdropOpen}` : ""}`}
        onClick={() => closeDrawer()}
        tabIndex={-1}
        type="button"
      />

      <aside
        aria-hidden={!open}
        aria-label={copy.menu}
        aria-modal="true"
        className={`${styles.drawer}${open ? ` ${styles.drawerOpen}` : ""}`}
        id="couponshare-app-menu"
        inert={!open}
        ref={drawerRef}
        role="dialog"
      >
        <header className={styles.header}>
          <a className={styles.brand} href="/" onClick={() => closeDrawer(false)}>
            <span>C</span><strong>CouponShare</strong>
          </a>
          <button aria-label={copy.closeMenu} className={styles.close} onClick={() => closeDrawer()} ref={closeRef} type="button">×</button>
        </header>

        <div className={styles.content}>
          <section className={styles.accountCard} aria-label={copy.account}>
            <small>{copy.account}</small>
            <strong title={status?.email ?? undefined}>{email}</strong>
            {status?.authenticated && <span>{providerLabel(status.provider)}</span>}
          </section>

          <nav className={styles.nav} aria-label={copy.menu}>
            <a href="/" onClick={() => closeDrawer(false)}><span aria-hidden="true">⌂</span><strong>{copy.home}</strong></a>
            <a href="/dunnes" onClick={() => closeDrawer(false)}><span aria-hidden="true">€</span><strong>{copy.dunnes}</strong></a>
            {status?.authenticated ? <>
              <a href="/profile" onClick={() => closeDrawer(false)}><span aria-hidden="true">○</span><strong>{copy.profile}</strong></a>
              <a href="/settings" onClick={() => closeDrawer(false)}><span aria-hidden="true">▤</span><strong>{copy.data}</strong></a>
            </> : (
              <a href={`/login?returnTo=${encodeURIComponent(pathname || "/")}`}><span aria-hidden="true">→</span><strong>{copy.login}</strong></a>
            )}
            <ErrorReportButton deviceKey={null} embedded onOpen={() => closeDrawer(false)} />
          </nav>

          <section className={styles.languageSection} aria-label={copy.language}>
            <small>{copy.language}</small>
            <div className={styles.languages}>
              {languages.map((item) => (
                <button
                  aria-pressed={language === item.id}
                  className={language === item.id ? styles.languageActive : ""}
                  key={item.id}
                  lang={item.id}
                  onClick={() => setLanguage(item.id)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>
        </div>

        {status?.authenticated && (
          <form action="/api/auth/logout" className={styles.logout} method="post" onSubmit={prepareLogout}>
            <button type="submit"><span aria-hidden="true">↪</span>{copy.logout}</button>
          </form>
        )}
      </aside>
    </>
  );
}

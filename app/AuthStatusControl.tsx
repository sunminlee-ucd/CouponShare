"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import styles from "./AuthStatusControl.module.css";

const DEVICE_KEY_STORAGE_KEY = "couponshare-device-key-v2";

type Status = {
  configured: boolean;
  required: boolean;
  authenticated: boolean;
};

export default function AuthStatusControl() {
  const pathname = usePathname();
  const [status, setStatus] = useState<Status | null>(null);
  const hidden = pathname.startsWith("/admin") || pathname === "/login" || pathname.startsWith("/auth/callback") || pathname.startsWith("/profile");

  useEffect(() => {
    if (hidden) return;
    let cancelled = false;
    void fetch("/api/auth/status", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<Status> : null)
      .then((result) => { if (!cancelled) setStatus(result); })
      .catch(() => { if (!cancelled) setStatus(null); });
    return () => { cancelled = true; };
  }, [hidden, pathname]);

  if (hidden || !status?.configured) return null;

  if (!status.authenticated) {
    const returnTo = pathname && pathname.startsWith("/") ? pathname : "/";
    const loginUrl = `/login?returnTo=${encodeURIComponent(returnTo)}`;
    return <button className={styles.control} type="button" onClick={() => window.location.assign(loginUrl)}>로그인</button>;
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      localStorage.removeItem(DEVICE_KEY_STORAGE_KEY);
      window.location.replace("/login");
    }
  }

  return (
    <div className={styles.group}>
      {pathname === "/" && <button className={styles.action} type="button" onClick={() => window.location.assign("/profile")}>프로필 설정</button>}
      <button className={styles.action} type="button" onClick={() => void logout()}>로그아웃</button>
    </div>
  );
}

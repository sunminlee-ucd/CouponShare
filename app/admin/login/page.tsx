"use client";

import { FormEvent, useState } from "react";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 10_000);
      const response = await fetch("/api/admin/login", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
        signal: controller.signal,
      });
      window.clearTimeout(timeout);
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setMessage(result.error === "too_many_attempts"
          ? "입력 횟수를 초과했습니다. 15분 후 다시 시도해 주세요."
          : result.error === "invalid_password" ? "비밀번호를 다시 확인해 주세요." : "로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      window.location.assign("/admin");
    } catch {
      setMessage("잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="access-shell">
    <section className="access-card admin-login-card">
      <div className="brand"><span className="brand-mark">C</span><span>CouponShare Admin</span></div>
      <p className="eyebrow">ADMIN ACCESS</p>
      <h1>관리자 로그인</h1>
      <p>이 기기에서는 로그인 상태가 유지되며, 이용할 때마다 자동 연장됩니다.</p>
      <form action="/api/admin/login" method="post" onSubmit={submit}>
        <label htmlFor="admin-password">관리자 비밀번호</label>
        <input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        <button type="submit" disabled={submitting}>{submitting ? "로그인 중…" : "로그인"}</button>
      </form>
      {message && <p className="access-error" role="alert">{message}</p>}
    </section>
  </main>;
}

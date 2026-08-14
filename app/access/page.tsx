"use client";

import { FormEvent, useState } from "react";

export default function AccessPage() {
  const [accessCode, setAccessCode] = useState("");
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accessCode, acceptedPrivacy, acceptedTerms }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setMessage(result.error === "too_many_attempts"
          ? "입력 횟수를 초과했습니다. 15분 후 다시 시도해 주세요."
          : result.error === "invalid_access_code" ? "초대코드를 다시 확인해 주세요." : "동의 항목과 초대코드를 확인해 주세요.");
        return;
      }
      const returnTo = new URLSearchParams(location.search).get("returnTo");
      location.assign(returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/");
    } catch {
      setMessage("잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="access-shell">
      <section className="access-card">
        <div className="brand"><span className="brand-mark">C</span><span>CouponShare</span></div>
        <p className="eyebrow">PRIVATE TEST</p>
        <h1>초대받은 분만 이용할 수 있어요</h1>
        <p>운영자가 전달한 초대코드를 입력해 주세요. 코드는 브라우저나 기기에 저장하지 않습니다.</p>
        <form onSubmit={submit}>
          <label htmlFor="access-code">초대코드</label>
          <input id="access-code" autoComplete="one-time-code" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} required />
          <label className="access-consent"><input type="checkbox" checked={acceptedPrivacy} onChange={(event) => setAcceptedPrivacy(event.target.checked)} /><span><a href="/privacy" target="_blank">개인정보처리방침</a>을 확인했습니다.</span></label>
          <label className="access-consent"><input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} /><span><a href="/terms" target="_blank">테스트 이용약관</a>에 동의합니다.</span></label>
          <button type="submit" disabled={submitting || !acceptedPrivacy || !acceptedTerms}>{submitting ? "확인 중…" : "시작하기"}</button>
        </form>
        {message && <p className="access-error" role="alert">{message}</p>}
      </section>
    </main>
  );
}

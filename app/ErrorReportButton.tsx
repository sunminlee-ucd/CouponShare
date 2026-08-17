"use client";

import { FormEvent, useState } from "react";
import { useLanguage } from "./i18n";

type ErrorCategory = "screen" | "access" | "coupon" | "other";

export default function ErrorReportButton({ deviceKey }: { deviceKey: string | null }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ErrorCategory>("screen");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [notice, setNotice] = useState("");

  function close() {
    if (status === "sending") return;
    setOpen(false);
    setStatus("idle");
    setNotice("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!deviceKey) {
      setStatus("error");
      setNotice("잠시 후 다시 시도해 주세요.");
      return;
    }

    setStatus("sending");
    setNotice("");
    try {
      const response = await fetch("/api/error-reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deviceKey, category, message, pagePath: window.location.pathname }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error === "rate_limit"
          ? "오류 신고는 하루 3회까지 가능합니다."
          : "신고를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
      setStatus("sent");
      setMessage("");
      setNotice("오류 내용을 전달했습니다. 확인 후 개선하겠습니다.");
    } catch (error) {
      setStatus("error");
      setNotice(error instanceof Error ? error.message : "신고를 저장하지 못했습니다.");
    }
  }

  return (
    <>
      <button className="topbar-error-button" type="button" onClick={() => setOpen(true)}>
        <span aria-hidden="true">!</span> {t("오류 신고")}
      </button>
      {open && (
        <div className="error-report-backdrop">
          <section aria-labelledby="error-report-title" aria-modal="true" className="error-report-dialog" role="dialog">
            <header>
              <div><p>HELP US IMPROVE</p><h2 id="error-report-title">{t("오류 신고")}</h2></div>
              <button type="button" onClick={close} aria-label={t("오류 신고 닫기")}>×</button>
            </header>
            {status === "sent" ? (
              <div className="error-report-success" role="status">
                <span aria-hidden="true">✓</span>
                <strong>{t(notice)}</strong>
                <button type="button" onClick={close}>{t("확인")}</button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <label>
                  <span>{t("어떤 오류인가요?")}</span>
                  <select value={category} onChange={(event) => setCategory(event.target.value as ErrorCategory)}>
                    <option value="screen">{t("화면·버튼")}</option>
                    <option value="access">{t("로그인·접속")}</option>
                    <option value="coupon">{t("쿠폰·바우처")}</option>
                    <option value="other">{t("기타")}</option>
                  </select>
                </label>
                <label>
                  <span>{t("오류 내용")}</span>
                  <textarea
                    maxLength={1000}
                    minLength={10}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder={t("어떤 작업에서 문제가 생겼는지 적어 주세요.")}
                    required
                    rows={5}
                    value={message}
                  />
                </label>
                <small>{t("비밀번호, 전화번호 등 개인정보는 입력하지 마세요.")}</small>
                {notice && <p className="error-report-notice" role="alert">{t(notice)}</p>}
                <div className="error-report-actions">
                  <button className="secondary" disabled={status === "sending"} type="button" onClick={close}>{t("취소")}</button>
                  <button disabled={status === "sending" || message.trim().length < 10} type="submit">
                    {t(status === "sending" ? "보내는 중…" : "오류 보내기")}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}

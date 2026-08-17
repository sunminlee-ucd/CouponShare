"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "./i18n";

export default function IosInAppBrowserNotice({ destinationPath = "/lidl-import" }: { destinationPath?: string }) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [targetUrl, setTargetUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const userAgent = navigator.userAgent;
    const isKakaoIos = /iPhone|iPad|iPod/i.test(userAgent) && /KAKAOTALK\/.*\(INAPP\)/i.test(userAgent);
    if (!isKakaoIos) return;
    const timer = window.setTimeout(() => {
      setTargetUrl(new URL(destinationPath, location.origin).href);
      setVisible(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [destinationPath]);

  function copySafariUrl() {
    if (!inputRef.current) return;
    inputRef.current.focus();
    inputRef.current.select();
    inputRef.current.setSelectionRange(0, targetUrl.length);
    const copiedWithSelection = document.execCommand("copy");
    if (!copiedWithSelection) void navigator.clipboard?.writeText(targetUrl).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  if (!visible) return null;

  return (
    <aside className="kakao-browser-notice" role="alert">
      <div className="kakao-browser-icon" aria-hidden="true">!</div>
      <div className="kakao-browser-copy">
        <strong>{t("카카오톡 안에서는 가져오기 북마크를 사용할 수 없어요")}</strong>
        <p>{t("카카오톡 오른쪽 상단의 Safari 아이콘을 눌러 이 페이지를 Safari에서 여세요. 아이콘이 보이지 않으면 ⋯ 메뉴의 Safari로 열기 또는 다른 브라우저로 열기를 선택하세요.")}</p>
        <div className="kakao-browser-actions">
          <input ref={inputRef} aria-label={t("Safari에서 열 CouponShare 주소")} readOnly value={targetUrl} />
          <button type="button" onClick={copySafariUrl}>{copied ? t("주소 복사됨") : t("Safari용 주소 복사")}</button>
        </div>
      </div>
    </aside>
  );
}

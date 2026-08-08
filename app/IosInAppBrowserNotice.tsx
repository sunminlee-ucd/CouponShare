"use client";

import { useEffect, useRef, useState } from "react";

export default function IosInAppBrowserNotice({ destinationPath = "/lidl-import" }: { destinationPath?: string }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [targetUrl, setTargetUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const userAgent = navigator.userAgent;
    const isKakaoIos = /iPhone|iPad|iPod/i.test(userAgent) && /KAKAOTALK\/.*\(INAPP\)/i.test(userAgent);
    if (!isKakaoIos) return;
    setTargetUrl(new URL(destinationPath, location.origin).href);
    setVisible(true);
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
        <strong>카카오톡 안에서는 가져오기 북마크를 사용할 수 없어요</strong>
        <p>카카오톡 오른쪽 상단의 <b>Safari 아이콘</b>을 눌러 이 페이지를 Safari에서 여세요. 아이콘이 보이지 않으면 <b>⋯ 메뉴</b>의 Safari로 열기 또는 다른 브라우저로 열기를 선택하세요.</p>
        <div className="kakao-browser-actions">
          <input ref={inputRef} aria-label="Safari에서 열 CouponShare 주소" readOnly value={targetUrl} />
          <button type="button" onClick={copySafariUrl}>{copied ? "주소 복사됨" : "Safari용 주소 복사"}</button>
        </div>
      </div>
    </aside>
  );
}

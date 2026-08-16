"use client";

import { useEffect, useState } from "react";

export default function AdminAccessCodeCopy({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2_000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      const input = document.createElement("textarea");
      input.value = code;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      const succeeded = document.execCommand("copy");
      input.remove();
      if (succeeded) setCopied(true);
    }
  }

  return (
    <button className="policy-copy-button" type="button" onClick={copyCode} disabled={!code} aria-live="polite">
      {copied ? "복사됨" : "복사"}
    </button>
  );
}

"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const OAUTH_CONTEXT_STORAGE_KEY = "couponshare-oauth-context-v1";
const GOOGLE_OAUTH_PATH = "/api/auth/oauth?provider=google";

function safeReturnTo(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default function GoogleOAuthNavigationGuard() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/login") return;

    const handleGoogleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button");
      if (!(button instanceof HTMLButtonElement) || button.disabled) return;
      if (!button.querySelector('svg[viewBox="0 0 18 18"]')) return;

      const params = new URLSearchParams(window.location.search);
      const returnTo = safeReturnTo(params.get("returnTo"));
      const autoLoginInput = document.querySelector('input[type="checkbox"]');
      const autoLogin = autoLoginInput instanceof HTMLInputElement && autoLoginInput.checked;

      try {
        sessionStorage.setItem(OAUTH_CONTEXT_STORAGE_KEY, JSON.stringify({
          returnTo,
          autoLogin,
          intent: "login",
          startedAt: Date.now(),
        }));
      } catch {
        // OAuth can continue with safe defaults if session storage is unavailable.
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.href = GOOGLE_OAUTH_PATH;
    };

    document.addEventListener("click", handleGoogleClick, true);
    return () => document.removeEventListener("click", handleGoogleClick, true);
  }, [pathname]);

  return null;
}

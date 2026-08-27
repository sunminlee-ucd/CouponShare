"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const OAUTH_CONTEXT_STORAGE_KEY = "couponshare-oauth-context-v1";

function safeReturnTo(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default function LoginGoogleOAuthNavigationFix() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/login") return;

    function handleClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button");
      if (!button || !button.textContent?.includes("Google")) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const params = new URLSearchParams(window.location.search);
      const returnTo = safeReturnTo(params.get("returnTo"));
      const autoLoginInput = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
        .find((input) => !input.disabled);

      try {
        sessionStorage.setItem(OAUTH_CONTEXT_STORAGE_KEY, JSON.stringify({
          returnTo,
          autoLogin: autoLoginInput?.checked === true,
          intent: "login",
          startedAt: Date.now(),
        }));
      } catch {
        // OAuth can continue safely without sessionStorage context.
      }

      window.location.href = "/api/auth/oauth?provider=google";
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname]);

  return null;
}

"use client";

import { useEffect, useState } from "react";

const LOGIN_PATH = "/login?returnTo=%2Fdunnes";

type AuthStatus = {
  configured: boolean;
  authenticated: boolean;
};

function isProtectedDunnesAction(target: Element) {
  if (target.closest(".dunnes-upload")) return true;
  if (target.closest(".dunnes-draft-actions")) return true;
  if (target.closest(".dunnes-used-check")) return true;
  if (target.closest(".dunnes-report-actions")) return true;
  if (target.closest(".dunnes-report-button")) return true;
  if (target.closest(".dunnes-mine")) return true;
  if (target.closest(".dunnes-reserved")) return true;

  const button = target.closest("button");
  const listItem = button?.closest(".dunnes-list-item");
  return Boolean(listItem && !listItem.classList.contains("mine") && !listItem.classList.contains("busy"));
}

export default function DunnesGuestActionGuard() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const response = await fetch("/api/auth/status", { cache: "no-store" });
        const status = response.ok ? await response.json() as AuthStatus : null;
        if (!cancelled) setAuthenticated(Boolean(status?.configured && status.authenticated));
      } catch {
        if (!cancelled) setAuthenticated(false);
      }
    };

    void refresh();
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    if (authenticated !== false) return;

    const blockGuestAction = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element) || !isProtectedDunnesAction(target)) return;
      event.preventDefault();
      event.stopPropagation();
      if ("stopImmediatePropagation" in event) event.stopImmediatePropagation();
      window.location.assign(LOGIN_PATH);
    };

    document.addEventListener("click", blockGuestAction, true);
    document.addEventListener("change", blockGuestAction, true);
    return () => {
      document.removeEventListener("click", blockGuestAction, true);
      document.removeEventListener("change", blockGuestAction, true);
    };
  }, [authenticated]);

  return null;
}

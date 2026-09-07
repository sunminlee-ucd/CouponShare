"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const EXCLUDED_PREFIXES = ["/admin", "/maintenance", "/diagnostics", "/privacy", "/terms"];
const START_DELAY_MS = 900;
const REQUEST_TIMEOUT_MS = 2_000;

function shouldCheck(pathname: string) {
  return !EXCLUDED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default function MaintenancePageGuard() {
  const pathname = usePathname();

  useEffect(() => {
    if (!shouldCheck(pathname)) return;
    const controller = new AbortController();
    let requestTimer: number | undefined;

    const startTimer = window.setTimeout(() => {
      requestTimer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      void fetch("/api/maintenance-access", {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      })
        .then((response) => response.ok ? response.json() as Promise<{ blocked?: boolean }> : null)
        .then((result) => {
          if (result?.blocked) window.location.replace("/maintenance");
        })
        .catch(() => undefined)
        .finally(() => {
          if (requestTimer !== undefined) window.clearTimeout(requestTimer);
        });
    }, START_DELAY_MS);

    return () => {
      window.clearTimeout(startTimer);
      if (requestTimer !== undefined) window.clearTimeout(requestTimer);
      controller.abort();
    };
  }, [pathname]);

  return null;
}

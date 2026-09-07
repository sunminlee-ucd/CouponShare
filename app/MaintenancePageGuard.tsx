"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const EXCLUDED_PREFIXES = ["/admin", "/maintenance", "/diagnostics", "/privacy", "/terms"];

function shouldCheck(pathname: string) {
  return !EXCLUDED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default function MaintenancePageGuard() {
  const pathname = usePathname();

  useEffect(() => {
    if (!shouldCheck(pathname)) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 2_000);

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
      .finally(() => window.clearTimeout(timer));

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [pathname]);

  return null;
}

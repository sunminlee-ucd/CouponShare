"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const SESSION_STORAGE_KEY = "couponshare-app-session-v1";
const HEARTBEAT_MS = 45_000;
const EXCLUDED_PREFIXES = ["/admin", "/login", "/auth", "/privacy", "/terms", "/maintenance", "/diagnostics"];

function getSessionId() {
  const saved = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (saved) return saved;
  const created = crypto.randomUUID();
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, created);
  return created;
}

function shouldTrack(pathname: string) {
  return !EXCLUDED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

async function sendActivity(action: "start" | "heartbeat" | "page_view" | "end", sessionId: string, pathname: string, keepalive = false) {
  try {
    const response = await fetch("/api/activity-session", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, sessionId, path: pathname }),
      keepalive,
    });
    if (!response.ok) return false;
    const result = await response.json() as { tracked?: boolean };
    return result.tracked !== false;
  } catch {
    // Activity analytics must never interrupt the user experience.
    return false;
  }
}

export default function AppActivityTracker() {
  const pathname = usePathname();
  const sessionIdRef = useRef<string | null>(null);
  const activeRef = useRef(false);
  const currentPathRef = useRef(pathname);
  const lastTrackedPathRef = useRef<string | null>(null);

  useEffect(() => {
    currentPathRef.current = pathname;
    if (!shouldTrack(pathname)) {
      if (activeRef.current && sessionIdRef.current) {
        void sendActivity("end", sessionIdRef.current, lastTrackedPathRef.current ?? pathname, true);
      }
      activeRef.current = false;
      lastTrackedPathRef.current = null;
      return;
    }

    const sessionId = sessionIdRef.current ?? getSessionId();
    sessionIdRef.current = sessionId;
    if (!activeRef.current) {
      activeRef.current = true;
      lastTrackedPathRef.current = pathname;
      void sendActivity("start", sessionId, pathname).then((tracked) => {
        if (!tracked) {
          activeRef.current = false;
          lastTrackedPathRef.current = null;
        }
      });
      return;
    }

    if (lastTrackedPathRef.current !== pathname) {
      lastTrackedPathRef.current = pathname;
      void sendActivity("page_view", sessionId, pathname);
    }
  }, [pathname]);

  useEffect(() => {
    const heartbeat = window.setInterval(() => {
      if (!activeRef.current || !sessionIdRef.current) return;
      void sendActivity("heartbeat", sessionIdRef.current, currentPathRef.current);
    }, HEARTBEAT_MS);

    const endSession = () => {
      if (!activeRef.current || !sessionIdRef.current) return;
      void sendActivity("end", sessionIdRef.current, currentPathRef.current, true);
    };

    window.addEventListener("pagehide", endSession);
    window.addEventListener("beforeunload", endSession);
    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener("pagehide", endSession);
      window.removeEventListener("beforeunload", endSession);
    };
  }, []);

  return null;
}

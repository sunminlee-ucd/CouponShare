"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const SESSION_STORAGE_KEY = "couponshare-app-session-v1";
const HEARTBEAT_MS = 45_000;
const EXCLUDED_PREFIXES = ["/admin", "/login", "/auth", "/privacy", "/terms", "/maintenance", "/diagnostics"];

type ActivityResult = "tracked" | "untracked" | "session_not_found";

function createSessionId() {
  const created = crypto.randomUUID();
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, created);
  return created;
}

function getSessionId() {
  return window.sessionStorage.getItem(SESSION_STORAGE_KEY) ?? createSessionId();
}

function clearSessionId(sessionId: string) {
  if (window.sessionStorage.getItem(SESSION_STORAGE_KEY) === sessionId) {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

function shouldTrack(pathname: string) {
  return !EXCLUDED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

async function sendActivity(action: "start" | "heartbeat" | "page_view" | "end", sessionId: string, pathname: string, keepalive = false): Promise<ActivityResult> {
  try {
    const response = await fetch("/api/activity-session", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, sessionId, path: pathname }),
      keepalive,
    });
    if (response.status === 409) return "session_not_found";
    if (!response.ok) return "untracked";
    const result = await response.json() as { tracked?: boolean };
    return result.tracked === false ? "untracked" : "tracked";
  } catch {
    // Activity analytics must never interrupt the user experience.
    return "untracked";
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
        const endingSessionId = sessionIdRef.current;
        clearSessionId(endingSessionId);
        void sendActivity("end", endingSessionId, lastTrackedPathRef.current ?? pathname, true);
      }
      sessionIdRef.current = null;
      activeRef.current = false;
      lastTrackedPathRef.current = null;
      return;
    }

    const sessionId = sessionIdRef.current ?? getSessionId();
    sessionIdRef.current = sessionId;
    if (!activeRef.current) {
      activeRef.current = true;
      lastTrackedPathRef.current = pathname;
      void sendActivity("start", sessionId, pathname).then(async (result) => {
        if (result === "session_not_found") {
          clearSessionId(sessionId);
          const replacementSessionId = createSessionId();
          sessionIdRef.current = replacementSessionId;
          const retryResult = await sendActivity("start", replacementSessionId, pathname);
          if (retryResult === "tracked") return;
        } else if (result === "tracked") {
          return;
        }

        activeRef.current = false;
        lastTrackedPathRef.current = null;
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
      const endingSessionId = sessionIdRef.current;
      clearSessionId(endingSessionId);
      void sendActivity("end", endingSessionId, currentPathRef.current, true);
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

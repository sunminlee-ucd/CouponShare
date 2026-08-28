"use client";

import { useEffect, useState } from "react";
import styles from "./maintenance.module.css";

type MaintenanceStatus = {
  enabled: boolean;
  durationMinutes: number;
  startedAt: string | null;
  recoveryAt: string | null;
};

const COPY = {
  eyebrow: "COUPONSHARE MAINTENANCE",
  title: "\uC11C\uBC84 \uC810\uAC80 \uBC0F \uBCF4\uC644 \uC911",
  body: "\uB354 \uC548\uC815\uC801\uC778 \uC11C\uBE44\uC2A4\uB97C \uC704\uD574 \uC7A0\uC2DC \uC810\uAC80\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4.",
  detail: "\uC810\uAC80\uC774 \uB05D\uB098\uBA74 \uC790\uB3D9\uC73C\uB85C \uB2E4\uC2DC \uC5F0\uACB0\uD569\uB2C8\uB2E4.",
  durationLabel: "\uC608\uC0C1 \uC810\uAC80 \uC2DC\uAC04",
  recoveryLabel: "\uC608\uC0C1 \uC11C\uBC84 \uD68C\uBCF5",
  check: "\uB2E4\uC2DC \uD655\uC778",
  checking: "\uD655\uC778 \uC911...",
};

function formatDuration(minutes: number) {
  if (minutes < 60) return `\uC57D ${minutes}\uBD84`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `\uC57D ${hours}\uC2DC\uAC04 ${remainder}\uBD84` : `\uC57D ${hours}\uC2DC\uAC04`;
}

function formatRecovery(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

async function fetchMaintenanceStatus() {
  const response = await fetch("/api/maintenance-status", { cache: "no-store" });
  if (!response.ok) throw new Error("maintenance_status_failed");
  return response.json() as Promise<MaintenanceStatus>;
}

export default function MaintenanceStatusClient({ initialStatus }: { initialStatus: MaintenanceStatus }) {
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState(initialStatus);

  async function checkStatus() {
    if (checking) return;
    setChecking(true);
    try {
      const next = await fetchMaintenanceStatus();
      if (!next.enabled) {
        window.location.replace("/login");
        return;
      }
      setStatus(next);
    } catch {
      // Stay on the maintenance screen while the service is unavailable.
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    let disposed = false;
    const interval = window.setInterval(() => {
      void fetchMaintenanceStatus().then((next) => {
        if (disposed) return;
        if (!next.enabled) {
          window.location.replace("/login");
          return;
        }
        setStatus(next);
      }).catch(() => undefined);
    }, 10_000);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <main className={styles.screen}>
      <section className={styles.card} aria-live="polite">
        <div className={styles.mark} aria-hidden="true">C</div>
        <p className={styles.eyebrow}>{COPY.eyebrow}</p>
        <h1>{COPY.title}</h1>
        <p className={styles.body}>{COPY.body}</p>
        <div className={styles.estimateGrid}>
          <div>
            <span>{COPY.durationLabel}</span>
            <strong>{formatDuration(status.durationMinutes)}</strong>
          </div>
          <div>
            <span>{COPY.recoveryLabel}</span>
            <strong>{formatRecovery(status.recoveryAt)}</strong>
          </div>
        </div>
        <p className={styles.detail}>{COPY.detail}</p>
        <div className={styles.progress} aria-hidden="true"><span /></div>
        <button type="button" disabled={checking} onClick={() => void checkStatus()}>
          {checking ? COPY.checking : COPY.check}
        </button>
      </section>
    </main>
  );
}

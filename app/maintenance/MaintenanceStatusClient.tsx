"use client";

import { useEffect, useState } from "react";
import styles from "./maintenance.module.css";

const COPY = {
  eyebrow: "COUPONSHARE MAINTENANCE",
  title: "\uC11C\uBC84 \uC810\uAC80 \uBC0F \uBCF4\uC644 \uC911",
  body: "\uB354 \uC548\uC815\uC801\uC778 \uC11C\uBE44\uC2A4\uB97C \uC704\uD574 \uC7A0\uC2DC \uC810\uAC80\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4.",
  detail: "\uC810\uAC80\uC774 \uB05D\uB098\uBA74 \uC790\uB3D9\uC73C\uB85C \uB2E4\uC2DC \uC5F0\uACB0\uD569\uB2C8\uB2E4.",
  check: "\uB2E4\uC2DC \uD655\uC778",
  checking: "\uD655\uC778 \uC911...",
};

export default function MaintenanceStatusClient() {
  const [checking, setChecking] = useState(false);

  async function checkStatus() {
    if (checking) return;
    setChecking(true);
    try {
      const response = await fetch("/api/maintenance-status", { cache: "no-store" });
      if (!response.ok) return;
      const result = await response.json() as { enabled?: boolean };
      if (result.enabled === false) window.location.replace("/login");
    } catch {
      // Stay on the maintenance screen while the service is unavailable.
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    const interval = window.setInterval(() => void checkStatus(), 10_000);
    return () => window.clearInterval(interval);
  });

  return (
    <main className={styles.screen}>
      <section className={styles.card} aria-live="polite">
        <div className={styles.mark} aria-hidden="true">C</div>
        <p className={styles.eyebrow}>{COPY.eyebrow}</p>
        <h1>{COPY.title}</h1>
        <p className={styles.body}>{COPY.body}</p>
        <p className={styles.detail}>{COPY.detail}</p>
        <div className={styles.progress} aria-hidden="true"><span /></div>
        <button type="button" disabled={checking} onClick={() => void checkStatus()}>
          {checking ? COPY.checking : COPY.check}
        </button>
      </section>
    </main>
  );
}

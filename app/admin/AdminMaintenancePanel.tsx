"use client";

import { useEffect, useState } from "react";

const COPY = {
  eyebrow: "SERVICE ACCESS",
  title: "\uC11C\uBC84 \uC810\uAC80 \uBAA8\uB4DC",
  body: "\uD65C\uC131\uD654\uD558\uBA74 \uC77C\uBC18 \uC0AC\uC6A9\uC790\uC758 \uC571 \uBC0F \uB85C\uADF8\uC778 \uC811\uADFC\uC744 \uC7A0\uC2DC \uB9C9\uACE0 \uC810\uAC80 \uC548\uB0B4 \uD654\uBA74\uC744 \uD45C\uC2DC\uD569\uB2C8\uB2E4.",
  adminSafe: "Admin \uACBD\uB85C\uC640 Admin API\uB294 \uC810\uAC80 \uC911\uC5D0\uB3C4 \uACC4\uC18D \uC811\uADFC\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
  statusOn: "\uD604\uC7AC \uC810\uAC80 \uBAA8\uB4DC ON",
  statusOff: "\uD604\uC7AC \uC810\uAC80 \uBAA8\uB4DC OFF",
  turnOn: "\uC810\uAC80 \uBAA8\uB4DC \uCF1C\uAE30",
  turnOff: "\uC810\uAC80 \uBAA8\uB4DC \uC885\uB8CC",
  saving: "\uC801\uC6A9 \uC911...",
  loading: "\uC0C1\uD0DC \uD655\uC778 \uC911...",
  error: "\uC810\uAC80 \uBAA8\uB4DC \uC0C1\uD0DC\uB97C \uCC98\uB9AC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.",
  confirmOn: "\uC77C\uBC18 \uC0AC\uC6A9\uC790\uC758 \uC811\uADFC\uC744 \uC989\uC2DC \uC810\uAC80 \uD654\uBA74\uB85C \uC804\uD658\uD560\uAE4C\uC694? Admin \uC811\uADFC\uC740 \uC720\uC9C0\uB429\uB2C8\uB2E4.",
};

export default function AdminMaintenancePanel() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/maintenance", { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error("load_failed");
        const result = await response.json() as { enabled?: boolean };
        if (!cancelled) setEnabled(result.enabled === true);
      })
      .catch(() => {
        if (!cancelled) setError(COPY.error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  async function toggle() {
    if (saving || loading) return;
    const next = !enabled;
    if (next && !window.confirm(COPY.confirmOn)) return;

    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/maintenance", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!response.ok) throw new Error("save_failed");
      const result = await response.json() as { enabled?: boolean };
      setEnabled(result.enabled === true);
    } catch {
      setError(COPY.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-maintenance-card" aria-live="polite">
      <div className="admin-maintenance-head">
        <div>
          <p>{COPY.eyebrow}</p>
          <h2>{COPY.title}</h2>
        </div>
        <span className={enabled ? "admin-maintenance-status active" : "admin-maintenance-status"}>
          {loading ? COPY.loading : enabled ? COPY.statusOn : COPY.statusOff}
        </span>
      </div>
      <p className="admin-maintenance-body">{COPY.body}</p>
      <p className="admin-maintenance-note">{COPY.adminSafe}</p>
      {error && <p className="admin-maintenance-error" role="alert">{error}</p>}
      <button
        type="button"
        className={enabled ? "admin-maintenance-toggle stop" : "admin-maintenance-toggle start"}
        disabled={loading || saving}
        onClick={() => void toggle()}
      >
        {saving ? COPY.saving : enabled ? COPY.turnOff : COPY.turnOn}
      </button>
    </section>
  );
}
